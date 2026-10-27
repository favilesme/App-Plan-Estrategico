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
import { getStageState, stageGate } from "@/lib/sprint6-review";
import { reviewSourceIds, type ReviewStage } from "@/lib/sprint6-review-policy.mts";
import { getCurrentCycle, getMembers } from "@/lib/workspace";
import { validateObjectiveDraft } from "@/lib/sprint6-policy.mts";

const objectivePath = "/modulos/objetivos";
const initiativePath = "/modulos/iniciativas";
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const valid = (text: string, min: number, max: number) => text.length >= min && text.length <= max;

async function sourceContext(path: string) {
  const actor = await getActor();
  if (!actor?.organizationId || !actor.memberId) redirect(`${path}?error=permission`);
  const cycle = await getCurrentCycle(actor.organizationId);
  if (!cycle) redirect(`${path}?error=source`);
  const strategy = await getApprovedStrategy(cycle.id);
  if (!strategy?.choice_direction || !strategy.choice_rationale) redirect(`${path}?error=source`);
  const db = getD1();
  const member = await db.prepare("SELECT is_leader, is_director, status, role FROM members WHERE id = ? AND organization_id = ?")
    .bind(actor.memberId, actor.organizationId).first<{ is_leader: number; is_director: number; status: string; role: string }>();
  if (!member || member.status !== "active") redirect(`${path}?error=permission`);
  return { actor, cycle, strategy, db, member };
}

async function context(path: string) {
  const stage = path === objectivePath ? "objectives" : "initiatives";
  const ctx = await stageContext(stage);
  if (!ctx.member.is_leader || !["owner", "admin", "leader"].includes(ctx.member.role))
    redirect(`${path}?error=permission`);
  const moduleSlug = path === objectivePath ? "objetivos" : "iniciativas";
  const progress = await ctx.db.prepare("SELECT status FROM module_progress WHERE cycle_id = ? AND module_slug = ?")
    .bind(ctx.cycle.id, moduleSlug).first<{ status: string }>();
  if (progress?.status === "approved") redirect(`${path}?error=closed`);
  if (ctx.state.review?.status === "approved") redirect(`${path}?error=review_locked#revision-sprint6`);
  return ctx;
}

function audit(db: D1Database, ctx: Awaited<ReturnType<typeof sourceContext>>, event: string, subject: string, id: string,
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
  if (!objective || !["draft", "approved"].includes(objective.status) || !initiativeActionBelongsToObjective(objective.source_action_ids_json, sourceActionId) ||
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

const stagePath = (stage: ReviewStage) => stage === "objectives" ? objectivePath : initiativePath;
const stageSlug = (stage: ReviewStage) => stage === "objectives" ? "objetivos" : "iniciativas";

async function stageContext(stage: ReviewStage) {
  const ctx = await sourceContext(stagePath(stage));
  const [objectives, initiatives, actions, members] = await Promise.all([
    getObjectives(ctx.strategy.id), getInitiatives(ctx.cycle.id),
    getStrategicActions(ctx.strategy.action_set_id), getMembers(ctx.actor.organizationId!),
  ]);
  const state = await getStageState({ cycleId: ctx.cycle.id, assessmentId: ctx.strategy.id, stage,
    objectives, initiatives, members, approvedActionIds: actions.map((item) => item.id) });
  return { ...ctx, objectives, initiatives, actions, members, state };
}

async function voteStage(stage: ReviewStage, form: FormData) {
  const path = stagePath(stage), ctx = await stageContext(stage);
  const { actor, cycle, db, member, state } = ctx;
  if (field(form, "expected_subject") !== state.subject) redirect(`${path}?error=stale#revision-sprint6`);
  if (!member.is_leader || !["owner", "admin", "leader"].includes(member.role)) redirect(`${path}?error=permission#revision-sprint6`);
  if (state.approved || state.blockers.length || state.reviewRecorded) redirect(`${path}?error=review_locked#revision-sprint6`);
  if (state.votes.current.some((vote) => vote.reviewer_user_id === actor.user.userId))
    redirect(`${path}?error=voted#revision-sprint6`);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["validated", "doubt", "changes_requested"].includes(decision) || !valid(rationale, 10, 1500))
    redirect(`${path}?error=vote#revision-sprint6`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, stageGate(stage, "vote"), state.subject, decision, actor.user.userId,
        rationale, JSON.stringify(state.tokens), cycle.methodology_version),
    audit(db, ctx, `sprint6.${stage}.voted`, `strategic_${stage}`, state.subject,
      { voteId: id, decision, rationale, sourceVersions: state.tokens }),
  ]);
  refresh(); redirect(`${path}?voted=1#revision-sprint6`);
}

async function reviewStage(stage: ReviewStage, form: FormData) {
  const path = stagePath(stage), ctx = await stageContext(stage);
  const { actor, cycle, db, state } = ctx;
  if (field(form, "expected_subject") !== state.subject) redirect(`${path}?error=stale#revision-sprint6`);
  if (actor.role !== "consultant") redirect(`${path}?error=permission#revision-sprint6`);
  if (!state.readyForReview || state.reviewRecorded) redirect(`${path}?error=quorum#revision-sprint6`);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["approved", "changes_requested"].includes(decision) || !valid(rationale, 10, 1500))
    redirect(`${path}?error=review#revision-sprint6`);
  const voteIds = state.votes.current.map((vote) => vote.id), id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, stageGate(stage, "review"), state.subject, decision, actor.user.userId,
        rationale, JSON.stringify(reviewSourceIds(state.tokens, voteIds)), cycle.methodology_version),
    audit(db, ctx, `sprint6.${stage}.reviewed`, `strategic_${stage}`, state.subject,
      { reviewId: id, decision, rationale, voteIds, sourceVersions: state.tokens }),
  ]);
  await progress(db, cycle.id, stageSlug(stage), decision === "approved" ? 90 : stage === "objectives" ? 80 : 40,
    decision === "approved" ? "Revisión favorable del consultor · decisión final del director pendiente"
      : "El consultor solicitó cambios · nueva versión y participación requeridas", actor.user.userId);
  refresh(); redirect(`${path}?reviewed=1#revision-sprint6`);
}

async function approveStage(stage: ReviewStage, form: FormData) {
  const path = stagePath(stage), ctx = await stageContext(stage);
  const { actor, cycle, db, member, state, objectives, initiatives } = ctx;
  if (field(form, "expected_subject") !== state.subject) redirect(`${path}?error=stale#revision-sprint6`);
  if (!member.is_director || !member.is_leader || !["owner", "admin", "leader"].includes(member.role))
    redirect(`${path}?error=permission#revision-sprint6`);
  if (!state.readyForFinal || !state.review) redirect(`${path}?error=review#revision-sprint6`);
  const rationale = field(form, "rationale");
  if (!valid(rationale, 20, 2000)) redirect(`${path}?error=decision#revision-sprint6`);
  const table = stage === "objectives" ? "strategic_objectives" : "strategic_initiatives";
  const where = stage === "objectives" ? "assessment_id = ? AND cycle_id = ?" : "cycle_id = ?";
  const filters = stage === "objectives" ? [ctx.strategy.id, cycle.id] : [cycle.id];
  const tokenExpression = stage === "objectives" ? "'o:' || id || ':v' || version"
    : "'i:' || id || ':v' || version || ':o:' || objective_id || ':v' || objective_version";
  const count = stage === "objectives" ? objectives.length : initiatives.length;
  const placeholders = state.tokens.map(() => "?").join(", ");
  const result = await db.prepare(`UPDATE ${table} SET status = 'approved', updated_at = CURRENT_TIMESTAMP
    WHERE ${where} AND status = 'draft'
      AND (SELECT COUNT(*) FROM ${table} WHERE ${where}) = ?
      AND (SELECT COUNT(*) FROM ${table} WHERE ${where} AND status = 'draft'
        AND ${tokenExpression} IN (${placeholders})) = ?`)
    .bind(...filters, ...filters, count, ...filters, ...state.tokens, count).run();
  if (result.meta.changes !== count) redirect(`${path}?error=stale#revision-sprint6`);
  const id = crypto.randomUUID(), voteIds = state.votes.current.map((vote) => vote.id);
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, ?, ?, 'approved', ?, ?, ?, ?)")
      .bind(id, cycle.id, stageGate(stage, "final"), state.subject, actor.user.userId, rationale,
        JSON.stringify([state.review.id, ...state.tokens]), cycle.methodology_version),
    audit(db, ctx, `sprint6.${stage}.approved`, `strategic_${stage}`, state.subject,
      { approvalId: id, reviewId: state.review.id, voteIds, rationale, sourceVersions: state.tokens }),
    db.prepare(`INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary,
      updated_by_user_id, approved_by_user_id, approved_at)
      VALUES (?, ?, ?, 'approved', 100, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = 'approved', percent = 100,
        summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id,
        approved_by_user_id = excluded.approved_by_user_id, approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`)
      .bind(crypto.randomUUID(), cycle.id, stageSlug(stage),
        `${count} ${stage === "objectives" ? "objetivos" : "iniciativas"} aprobados · revisión humana y decisión del director registradas`,
        actor.user.userId, actor.user.userId),
  ]);
  refresh(); redirect(`${path}?approved=1#revision-sprint6`);
}

export async function voteObjectives(form: FormData) { return voteStage("objectives", form); }
export async function reviewObjectives(form: FormData) { return reviewStage("objectives", form); }
export async function approveObjectives(form: FormData) { return approveStage("objectives", form); }
export async function voteInitiatives(form: FormData) { return voteStage("initiatives", form); }
export async function reviewInitiatives(form: FormData) { return reviewStage("initiatives", form); }
export async function approveInitiatives(form: FormData) { return approveStage("initiatives", form); }
