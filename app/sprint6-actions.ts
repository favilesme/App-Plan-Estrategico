"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getD1 } from "@/db";
import { getActor } from "@/lib/authz";
import { getStrategicActions } from "@/lib/sprint5";
import { getMatrixSource } from "@/lib/sprint4";
import { getApprovedStrategy, getInitiatives, getObjectives, sourceEvidenceIds,
  bscCoverage, initiativeActionBelongsToObjective,
  type StrategicInitiative, type StrategicObjective } from "@/lib/sprint6";
import { getCurrentCycle } from "@/lib/workspace";
import { validateObjectiveDraft } from "@/lib/sprint6-policy.mts";

const objectivePath = "/modulos/objetivos";
const initiativePath = "/modulos/iniciativas";
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const valid = (text: string, min: number, max: number) => text.length >= min && text.length <= max;

async function context(path: string) {
  const actor = await getActor();
  if (!actor?.organizationId || !actor.memberId) redirect(`${path}?error=permission`);
  const cycle = await getCurrentCycle(actor.organizationId);
  if (!cycle) redirect(`${path}?error=source`);
  const strategy = await getApprovedStrategy(cycle.id);
  if (!strategy?.choice_direction || !strategy.choice_rationale) redirect(`${path}?error=source`);
  const db = getD1();
  const member = await db.prepare("SELECT is_leader, status, role FROM members WHERE id = ? AND organization_id = ?")
    .bind(actor.memberId, actor.organizationId).first<{ is_leader: number; status: string; role: string }>();
  if (!member || member.status !== "active" || !member.is_leader || !["owner", "admin", "leader"].includes(member.role))
    redirect(`${path}?error=permission`);
  return { actor, cycle, strategy, db };
}

function audit(db: D1Database, ctx: Awaited<ReturnType<typeof context>>, event: string, subject: string, id: string,
  payload: unknown) {
  return db.prepare("INSERT INTO audit_events (id, organization_id, cycle_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), ctx.actor.organizationId, ctx.cycle.id, ctx.actor.user.userId,
      ctx.actor.user.email.toLowerCase(), event, subject, id, JSON.stringify(payload));
}

async function progress(db: D1Database, cycleId: string, slug: string, percent: number, summary: string, userId: string) {
  await db.prepare("INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary, updated_by_user_id) VALUES (?, ?, ?, 'in_progress', ?, ?, ?) ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = 'in_progress', percent = excluded.percent, summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(crypto.randomUUID(), cycleId, slug, percent, summary, userId).run();
}

function refresh() { revalidatePath("/"); revalidatePath(objectivePath); revalidatePath(initiativePath); }

export async function saveObjective(form: FormData) {
  const ctx = await context(objectivePath);
  const { db, strategy, cycle, actor } = ctx;
  const id = field(form, "id"), version = Number(field(form, "version"));
  const perspective = field(form, "perspective"), statement = field(form, "statement");
  const desiredResult = field(form, "desired_result"), strategyLink = field(form, "strategy_link");
  const evidenceNote = field(form, "evidence_note"), kpiName = field(form, "kpi_name");
  const kpiUnit = field(form, "kpi_unit"), kpiDefinition = field(form, "kpi_definition");
  const actionIds = [...new Set(form.getAll("source_action_id").map(String).map((s) => s.trim()))];
  const actions = await getStrategicActions(strategy.action_set_id);
  const issues = validateObjectiveDraft({ perspective, statement, desiredResult, strategyLink,
    sourceActionIds: actionIds, evidenceNote, kpiName, kpiUnit, kpiDefinition }, actions.map((action) => action.id));
  if (issues.length) redirect(`${objectivePath}?error=${issues[0]}`);
  const duplicate = await db.prepare("SELECT id FROM strategic_objectives WHERE assessment_id = ? AND lower(trim(statement)) = lower(?) AND id != ?")
    .bind(strategy.id, statement, id || "").first();
  if (duplicate) redirect(`${objectivePath}?error=duplicate`);
  const existing = id ? await db.prepare("SELECT * FROM strategic_objectives WHERE id = ? AND assessment_id = ? AND cycle_id = ?")
    .bind(id, strategy.id, cycle.id).first<StrategicObjective>() : null;
  if (id && (!existing || existing.status !== "draft" || existing.version !== version)) redirect(`${objectivePath}?error=stale`);
  if (existing) {
    const initiatives = (await getInitiatives(cycle.id)).filter((item) => item.objective_id === existing.id);
    if (initiatives.some((item) => !actionIds.includes(item.source_action_id))) redirect(`${objectivePath}?error=linked`);
  }
  const evidenceIds = sourceEvidenceIds(actions, actionIds);
  const source = await getMatrixSource(strategy.source_snapshot_id);
  const knownEvidence = new Set(source?.data.factors.flatMap((factor) => factor.evidence.map((item) => item.id)) ?? []);
  if (evidenceIds.length === 0 || evidenceIds.some((evidenceId) => !knownEvidence.has(evidenceId)))
    redirect(`${objectivePath}?error=evidence`);
  const values = [perspective, statement, desiredResult, strategyLink, JSON.stringify(actionIds),
    JSON.stringify(evidenceIds), evidenceNote, kpiName, kpiUnit, kpiDefinition];
  const objectiveId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    const update = await db.prepare(`UPDATE strategic_objectives SET perspective = ?, statement = ?, desired_result = ?, strategy_link = ?,
      source_action_ids_json = ?, evidence_ids_json = ?, evidence_note = ?, kpi_name = ?, kpi_unit = ?, kpi_definition = ?,
      version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ? AND status = 'draft'`)
      .bind(...values, actor.user.userId, objectiveId, version).run();
    if (update.meta.changes !== 1) redirect(`${objectivePath}?error=stale`);
  } else {
    await db.prepare(`INSERT INTO strategic_objectives (id, cycle_id, assessment_id, perspective, statement, desired_result,
      strategy_link, source_action_ids_json, evidence_ids_json, evidence_note, kpi_name, kpi_unit, kpi_definition, updated_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(objectiveId, cycle.id, strategy.id, ...values, actor.user.userId).run();
  }
  await audit(db, ctx, existing ? "objective.updated" : "objective.created", "strategic_objective", objectiveId,
    { version: existing ? version + 1 : 1, sourceAssessment: `${strategy.id}:r${strategy.revision}`,
      decision: strategy.choice_direction, values, previous: existing ?? null }).run();
  const objectives = await getObjectives(strategy.id), coverage = bscCoverage(objectives);
  await progress(db, cycle.id, "objetivos", Math.round(coverage.count / 4 * 80),
    `${objectives.length} objetivos en borrador · ${coverage.count}/4 perspectivas BSC`, actor.user.userId);
  refresh(); redirect(`${objectivePath}?saved=1#objetivo-${objectiveId}`);
}

export async function saveInitiative(form: FormData) {
  const ctx = await context(initiativePath);
  const { db, strategy, cycle, actor } = ctx;
  const id = field(form, "id"), version = Number(field(form, "version"));
  const objectiveId = field(form, "objective_id"), sourceActionId = field(form, "source_action_id");
  const statement = field(form, "statement"), expectedResult = field(form, "expected_result");
  const responsibleId = field(form, "responsible_member_id"), evidenceNote = field(form, "evidence_note");
  const objective = (await getObjectives(strategy.id)).find((item) => item.id === objectiveId);
  const coverage = bscCoverage(await getObjectives(strategy.id));
  const responsible = await db.prepare("SELECT id FROM members WHERE id = ? AND organization_id = ? AND status = 'active'")
    .bind(responsibleId, actor.organizationId).first();
  if (coverage.count !== 4) redirect(`${initiativePath}?error=coverage`);
  if (!objective || objective.status !== "draft" || !initiativeActionBelongsToObjective(objective.source_action_ids_json, sourceActionId) ||
    !responsible || !valid(statement, 15, 300) || !valid(expectedResult, 15, 800) ||
    !valid(evidenceNote, 15, 1000)) redirect(`${initiativePath}?error=invalid`);
  const existing = id ? await db.prepare("SELECT * FROM strategic_initiatives WHERE id = ? AND cycle_id = ?")
    .bind(id, cycle.id).first<StrategicInitiative>() : null;
  if (id && (!existing || existing.status !== "draft" || existing.version !== version)) redirect(`${initiativePath}?error=stale`);
  const initiativeId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    const update = await db.prepare(`UPDATE strategic_initiatives SET objective_id = ?, objective_version = ?, source_action_id = ?, statement = ?,
      expected_result = ?, responsible_member_id = ?, evidence_note = ?, version = version + 1,
      updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ? AND status = 'draft'`)
      .bind(objectiveId, objective.version, sourceActionId, statement, expectedResult, responsibleId, evidenceNote,
        actor.user.userId, initiativeId, version).run();
    if (update.meta.changes !== 1) redirect(`${initiativePath}?error=stale`);
  } else {
    await db.prepare(`INSERT INTO strategic_initiatives (id, cycle_id, objective_id, objective_version, source_action_id, statement,
      expected_result, responsible_member_id, evidence_note, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(initiativeId, cycle.id, objectiveId, objective.version, sourceActionId, statement, expectedResult, responsibleId,
        evidenceNote, actor.user.userId).run();
  }
  await audit(db, ctx, existing ? "initiative.updated" : "initiative.created", "strategic_initiative", initiativeId,
    { version: existing ? version + 1 : 1, objectiveId, objectiveVersion: objective.version, sourceActionId, statement, expectedResult,
      responsibleId, evidenceNote, previous: existing ?? null }).run();
  const initiatives = await getInitiatives(cycle.id);
  await progress(db, cycle.id, "iniciativas", 40,
    `${initiatives.length} iniciativas vinculadas · en borrador`, actor.user.userId);
  refresh(); redirect(`${initiativePath}?saved=1#iniciativa-${initiativeId}`);
}
