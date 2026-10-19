"use server";

import { env } from "cloudflare:workers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getD1 } from "@/db";
import { actionPriorityConflict } from "@/lib/action-priority";
import { getActor } from "@/lib/authz";
import { matrixVoteState } from "@/lib/foda-matrix";
import { METHODOLOGY_VERSION } from "@/lib/methodology";
import { DIRECTIONS, CRITERIA, directionResult, viabilityScore, type Direction, type StrategicQuadrant } from "@/lib/mdep";
import { isHighLevelMember } from "@/lib/sprint2";
import { getFodaSet } from "@/lib/sprint3";
import { getMatrixSource, getMatrixVersions } from "@/lib/sprint4";
import { getActionSet, getActionVotes, getAffinities, getConditions, getCriteria, getDirectionBriefs, getMdep, getMdepVotes,
  getStrategicActions, latestGate, type ActionSet, type MdepAssessment } from "@/lib/sprint5";
import { getCurrentCycle, getMembers } from "@/lib/workspace";

const actionPath = "/modulos/formulacion", porterPath = "/modulos/porter";
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const jsonIds = (raw: string) => { try { const x: unknown = JSON.parse(raw); return Array.isArray(x) && x.every((v) => typeof v === "string") ? [...new Set(x)] as string[] : []; } catch { return []; } };

async function context(path: string) {
  const actor = await getActor();
  if (!actor?.organizationId) redirect(`${path}?error=permission`);
  const cycle = await getCurrentCycle(actor.organizationId);
  if (!cycle) redirect(`${path}?error=cycle`);
  const foda = await getFodaSet(cycle.id);
  const matrix = foda && (await getMatrixVersions(foda.id)).find((item) => item.set_version === foda.version);
  if (!matrix || matrix.status !== "approved") redirect(`${path}?error=source`);
  const source = await getMatrixSource(matrix.source_snapshot_id);
  if (!source) redirect(`${path}?error=source`);
  return { actor, cycle, matrix, source: source.data, db: getD1() };
}
async function leader(actor: NonNullable<Awaited<ReturnType<typeof getActor>>>, path: string) {
  if (!actor.organizationId || !actor.memberId || !(await isHighLevelMember(actor.organizationId, actor.memberId))) redirect(`${path}?error=permission`);
  const member = await getD1().prepare("SELECT is_leader, is_director, role, status FROM members WHERE id = ? AND organization_id = ?")
    .bind(actor.memberId, actor.organizationId).first<{ is_leader: number; is_director: number; role: string; status: string }>();
  if (!member || member.status !== "active" || !member.is_leader || !["owner", "admin", "leader"].includes(member.role)) redirect(`${path}?error=permission`);
  return member;
}
async function editableSet(matrixId: string, id: string, revision: number, path: string) {
  const set = await getActionSet(matrixId);
  if (!set || set.id !== id || set.status !== "draft" || set.revision !== revision) redirect(`${path}?error=stale`);
  return set;
}
async function editableMdep(setId: string, id: string, revision: number) {
  const assessment = await getMdep(setId);
  if (!assessment || assessment.id !== id || assessment.status !== "draft" || assessment.revision !== revision)
    redirect(`${porterPath}?error=stale`);
  return assessment;
}
function audit(db: D1Database, actor: NonNullable<Awaited<ReturnType<typeof getActor>>>, cycleId: string,
  eventType: string, subjectType: string, subjectId: string, payload: unknown) {
  return db.prepare("INSERT INTO audit_events (id, organization_id, cycle_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), actor.organizationId, cycleId, actor.user.userId, actor.user.email.toLowerCase(), eventType,
      subjectType, subjectId, JSON.stringify(payload));
}
function refresh() { revalidatePath("/"); revalidatePath(actionPath); revalidatePath(porterPath); }
async function progress(cycleId: string, slug: string, status: string, percent: number, summary: string, userId: string) {
  await getD1().prepare("INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = excluded.status, percent = excluded.percent, summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(crypto.randomUUID(), cycleId, slug, status, percent, summary, userId).run();
}
async function bumpSet(set: ActionSet) {
  const r = await getD1().prepare("UPDATE strategic_action_sets SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(set.id, set.revision).run();
  if (r.meta.changes !== 1) redirect(`${actionPath}?error=stale`);
}
async function bumpMdep(assessment: MdepAssessment) {
  const r = await getD1().prepare("UPDATE mdep_assessments SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(assessment.id, assessment.revision).run();
  if (r.meta.changes !== 1) redirect(`${porterPath}?error=stale`);
}

export async function startStrategicActions() {
  const { actor, cycle, matrix, db } = await context(actionPath);
  await leader(actor, actionPath);
  await db.prepare("INSERT OR IGNORE INTO strategic_action_sets (id, cycle_id, matrix_id) VALUES (?, ?, ?)")
    .bind(crypto.randomUUID(), cycle.id, matrix.id).run();
  const set = await getActionSet(matrix.id);
  if (!set) redirect(`${actionPath}?error=source`);
  await progress(cycle.id, "formulacion", "in_progress", 5, "Acciones estratégicas en formulación", actor.user.userId);
  refresh(); redirect(actionPath);
}

export async function saveActionScope(form: FormData) {
  const { actor, cycle, matrix, db } = await context(actionPath);
  await leader(actor, actionPath);
  const set = await editableSet(matrix.id, field(form, "set_id"), Number(field(form, "revision")), actionPath);
  const values = ["business_unit", "offer", "customers", "market"].map((key) => field(form, key));
  if (values.some((v) => v.length < 3 || v.length > 400)) redirect(`${actionPath}?error=scope`);
  await bumpSet(set);
  await db.batch([
    db.prepare("UPDATE strategic_action_sets SET business_unit = ?, offer = ?, customers = ?, market = ? WHERE id = ?")
      .bind(...values, set.id),
    audit(db, actor, cycle.id, "strategy.scope_saved", "strategic_action_set", set.id, { values, revision: set.revision + 1 }),
  ]);
  refresh(); redirect(`${actionPath}?saved=1`);
}

export async function saveStrategicAction(form: FormData) {
  const { actor, cycle, matrix, source, db } = await context(actionPath);
  await leader(actor, actionPath);
  const set = await editableSet(matrix.id, field(form, "set_id"), Number(field(form, "revision")), actionPath);
  const id = field(form, "action_id") || crypto.randomUUID();
  const existing = (await getStrategicActions(set.id)).find((item) => item.id === id);
  if (field(form, "action_id") && !existing) redirect(`${actionPath}?error=stale`);
  const quadrant = field(form, "quadrant") as StrategicQuadrant;
  const axes: Record<StrategicQuadrant, string[]> = { FO: ["F", "O"], FA: ["F", "A"], DO: ["D", "O"], DA: ["D", "A"] };
  if (!axes[quadrant]) redirect(`${actionPath}?error=action`);
  const factors = [...new Set(form.getAll("factor_id").map(String))];
  const selected = source.factors.filter((f) => factors.includes(f.id));
  if (selected.length !== factors.length || selected.length < 2 || axes[quadrant].some((axis) => !selected.some((f) => f.axis === axis)))
    redirect(`${actionPath}?error=factors`);
  const evidence = [...new Set(form.getAll("evidence_id").map(String))];
  const allowed = new Set(selected.flatMap((f) => f.evidence.map((e) => e.id)));
  if (!evidence.length || evidence.some((id) => !allowed.has(id))) redirect(`${actionPath}?error=evidence`);
  const statement = field(form, "statement"), expected = field(form, "expected_effect");
  const priority = Number(field(form, "priority")), rationale = field(form, "priority_rationale");
  if (statement.length < 12 || statement.length > 1000 || expected.length < 10 || expected.length > 1000 ||
    !Number.isInteger(priority) || priority < 1 || priority > 5 || rationale.length < 10 || rationale.length > 1000)
    redirect(`${actionPath}?error=action`);
  await bumpSet(set);
  await db.batch([
    db.prepare("INSERT INTO strategic_actions (id, action_set_id, quadrant, statement, expected_effect, factor_ids_json, evidence_ids_json, priority, priority_rationale, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET quadrant = excluded.quadrant, statement = excluded.statement, expected_effect = excluded.expected_effect, factor_ids_json = excluded.factor_ids_json, evidence_ids_json = excluded.evidence_ids_json, priority = excluded.priority, priority_rationale = excluded.priority_rationale, updated_by_user_id = excluded.updated_by_user_id, version = strategic_actions.version + 1, updated_at = CURRENT_TIMESTAMP")
      .bind(id, set.id, quadrant, statement, expected, JSON.stringify(factors), JSON.stringify(evidence), priority, rationale, actor.user.userId),
    audit(db, actor, cycle.id, existing ? "strategy.action_updated" : "strategy.action_created", "strategic_action", id,
      { setId: set.id, matrixId: matrix.id, quadrant, factors, evidence, priority, rationale,
        previous: existing ?? null, revision: set.revision + 1 }),
  ]);
  await progress(cycle.id, "formulacion", "in_progress", 50, "Acciones y prioridades en revisión", actor.user.userId);
  refresh(); redirect(`${actionPath}?saved=1`);
}

export async function removeStrategicAction(form: FormData) {
  const { actor, cycle, matrix, db } = await context(actionPath);
  await leader(actor, actionPath);
  const set = await editableSet(matrix.id, field(form, "set_id"), Number(field(form, "revision")), actionPath);
  const item = (await getStrategicActions(set.id)).find((a) => a.id === field(form, "action_id"));
  if (!item) redirect(`${actionPath}?error=stale`);
  await bumpSet(set);
  await db.batch([
    db.prepare("DELETE FROM strategic_actions WHERE id = ? AND action_set_id = ?").bind(item.id, set.id),
    audit(db, actor, cycle.id, "strategy.action_removed", "strategic_action", item.id,
      { previous: item, revision: set.revision + 1 }),
  ]);
  refresh(); redirect(`${actionPath}?saved=1`);
}

export async function voteStrategicActions(form: FormData) {
  const { actor, cycle, matrix, db } = await context(actionPath);
  await leader(actor, actionPath);
  const set = await editableSet(matrix.id, field(form, "set_id"), Number(field(form, "revision")), actionPath);
  const actions = await getStrategicActions(set.id);
  if (!set.business_unit || !set.offer || !set.customers || !set.market || !actions.length) redirect(`${actionPath}?error=incomplete`);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["validated", "doubt", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1000)
    redirect(`${actionPath}?error=vote`);
  const existing = (await getActionVotes(set)).find((v) => v.member_id === actor.memberId);
  if (existing) redirect(`${actionPath}?error=voted`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO strategic_action_votes (id, action_set_id, set_revision, member_id, decision, rationale) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, set.id, set.revision, actor.memberId, decision, rationale),
    audit(db, actor, cycle.id, "strategy.actions_voted", "strategic_action_set", set.id,
      { voteId: id, revision: set.revision, decision, rationale }),
  ]);
  refresh(); redirect(`${actionPath}?voted=1`);
}

export async function reviewStrategicActions(form: FormData) {
  const { actor, cycle, matrix, db } = await context(actionPath);
  if (actor.role !== "consultant") redirect(`${actionPath}?error=permission`);
  const set = await editableSet(matrix.id, field(form, "set_id"), Number(field(form, "revision")), actionPath);
  const actions = await getStrategicActions(set.id);
  const state = matrixVoteState((await getActionVotes(set)).map((v) => ({ ...v, matrix_id: v.action_set_id, matrix_revision: v.set_revision })),
    await getMembers(actor.organizationId!));
  if (!state.ready || !actions.length || !set.business_unit || !set.offer || !set.customers || !set.market)
    redirect(`${actionPath}?error=quorum`);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["approved", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500)
    redirect(`${actionPath}?error=review`);
  const subject = `${set.id}:r${set.revision}`;
  if (await latestGate(cycle.id, "strategy.actions", subject)) redirect(`${actionPath}?error=review`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, 'strategy.actions', ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, subject, decision, actor.user.userId, rationale,
        JSON.stringify([...actions.map((a) => `${a.id}:v${a.version}`), ...state.current.map((v) => v.id)]), METHODOLOGY_VERSION),
    audit(db, actor, cycle.id, "strategy.actions_reviewed", "strategic_action_set", set.id,
      { revision: set.revision, decision, rationale, approvalId: id }),
  ]);
  refresh(); redirect(`${actionPath}?reviewed=1`);
}

export async function approveStrategicActions(form: FormData) {
  const { actor, cycle, matrix, db } = await context(actionPath);
  const member = await leader(actor, actionPath);
  if (!member.is_director) redirect(`${actionPath}?error=permission`);
  const set = await editableSet(matrix.id, field(form, "set_id"), Number(field(form, "revision")), actionPath);
  const actions = await getStrategicActions(set.id);
  if (actions.some(actionPriorityConflict)) redirect(`${actionPath}?error=priority_conflict`);
  const state = matrixVoteState((await getActionVotes(set)).map((v) => ({ ...v, matrix_id: v.action_set_id, matrix_revision: v.set_revision })),
    await getMembers(actor.organizationId!));
  const review = await latestGate(cycle.id, "strategy.actions", `${set.id}:r${set.revision}`);
  const sourceIds = [...actions.map((a) => `${a.id}:v${a.version}`), ...state.current.map((v) => v.id)].sort();
  if (!state.ready || !actions.length || review?.status !== "approved" ||
    JSON.stringify(sourceIds) !== JSON.stringify(jsonIds(review.source_ids_json).sort())) redirect(`${actionPath}?error=review`);
  const result = await db.prepare("UPDATE strategic_action_sets SET status = 'approved', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(actor.user.userId, set.id, set.revision).run();
  if (result.meta.changes !== 1) redirect(`${actionPath}?error=stale`);
  await audit(db, actor, cycle.id, "strategy.actions_approved", "strategic_action_set", set.id,
    { matrixId: matrix.id, revision: set.revision, actionIds: actions.map((a) => a.id), reviewId: review.id }).run();
  await progress(cycle.id, "formulacion", "approved", 100, `${actions.length} acciones priorizadas · revisión aprobada`, actor.user.userId);
  refresh(); redirect(`${actionPath}?approved=1`);
}

/** Dirección opens a new working revision. Earlier votes, review and approval remain tied to their original revision. */
export async function reopenStrategicActions(form: FormData) {
  const { actor, cycle, matrix, db } = await context(actionPath);
  const member = await leader(actor, actionPath);
  if (!member.is_director) redirect(`${actionPath}?error=permission`);
  const set = await getActionSet(matrix.id);
  const revision = Number(field(form, "revision"));
  const reason = field(form, "reason");
  if (!set || set.id !== field(form, "set_id") || set.status !== "approved" ||
      !Number.isInteger(revision) || set.revision !== revision || reason.length < 10 || reason.length > 1500)
    redirect(`${actionPath}?error=reopen`);
  // A started MDEP references these action weights; it must never be silently invalidated.
  if (await getMdep(set.id)) redirect(`${actionPath}?error=mdep_started`);
  const actions = await getStrategicActions(set.id);
  const priorReview = await latestGate(cycle.id, "strategy.actions", `${set.id}:r${set.revision}`);
  const priorVotes = await getActionVotes(set);
  const result = await db.prepare("UPDATE strategic_action_sets SET status = 'draft', revision = revision + 1, approved_by_user_id = NULL, approved_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved' AND revision = ? AND NOT EXISTS (SELECT 1 FROM mdep_assessments WHERE action_set_id = ?)")
    .bind(set.id, set.revision, set.id).run();
  if (result.meta.changes !== 1) redirect(`${actionPath}?error=stale`);
  await audit(db, actor, cycle.id, "strategy.actions_reopened", "strategic_action_set", set.id,
    { reason, previousRevision: set.revision, nextRevision: set.revision + 1,
      previousApproval: { by: set.approved_by_user_id, at: set.approved_at, review: priorReview, votes: priorVotes },
      previousActions: actions }).run();
  await progress(cycle.id, "formulacion", "in_progress", 50,
    "Corrección de prioridades en revisión · requiere nuevo quórum y aprobación", actor.user.userId);
  refresh(); redirect(`${actionPath}?reopened=1`);
}

export async function startMdep() {
  const { actor, cycle, matrix, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  if ((await getStrategicActions(set.id)).some(actionPriorityConflict)) redirect(`${actionPath}?error=priority_conflict`);
  await db.prepare("INSERT OR IGNORE INTO mdep_assessments (id, action_set_id) SELECT ?, id FROM strategic_action_sets WHERE id = ? AND status = 'approved'")
    .bind(crypto.randomUUID(), set.id).run();
  if (!(await getMdep(set.id))) redirect(`${porterPath}?error=source`);
  await progress(cycle.id, "porter", "in_progress", 5, "MDEP en evaluación", actor.user.userId);
  refresh(); redirect(porterPath);
}

export async function saveMdepAffinity(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const action = (await getStrategicActions(set.id)).find((a) => a.id === field(form, "action_id"));
  const direction = field(form, "direction") as Direction, score = Number(field(form, "score"));
  const rationale = field(form, "rationale"), evidence = [...new Set(form.getAll("evidence_id").map(String))];
  if (!action || !DIRECTIONS.includes(direction) || !Number.isInteger(score) || score < 0 || score > 3 ||
    rationale.length < 10 || rationale.length > 1000 || !evidence.length ||
    evidence.some((id) => !jsonIds(action.evidence_ids_json).includes(id))) redirect(`${porterPath}?error=affinity`);
  const previous = (await getAffinities(mdep.id)).find((a) => a.action_id === action.id && a.direction === direction);
  await bumpMdep(mdep);
  await db.batch([
    db.prepare("INSERT INTO mdep_affinities (id, assessment_id, action_id, direction, score, rationale, evidence_ids_json, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(assessment_id, action_id, direction) DO UPDATE SET score = excluded.score, rationale = excluded.rationale, evidence_ids_json = excluded.evidence_ids_json, updated_by_user_id = excluded.updated_by_user_id, version = mdep_affinities.version + 1, updated_at = CURRENT_TIMESTAMP")
      .bind(crypto.randomUUID(), mdep.id, action.id, direction, score, rationale, JSON.stringify(evidence), actor.user.userId),
    audit(db, actor, cycle.id, "mdep.affinity_saved", "mdep_assessment", mdep.id,
      { actionId: action.id, direction, score, evidence, rationale, previous: previous ?? null, revision: mdep.revision + 1 }),
  ]);
  refresh(); redirect(`${porterPath}?saved=${encodeURIComponent(action.id)}#accion-${encodeURIComponent(action.id)}`);
}

export async function suggestMdepAffinities(form: FormData) {
  const { actor, cycle, matrix, source, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const action = (await getStrategicActions(set.id)).find((a) => a.id === field(form, "action_id"));
  if (!action || !env.OPENAI_API_KEY) redirect(`${porterPath}?error=ai_unavailable`);
  const ids = jsonIds(action.factor_ids_json), evidenceIds = jsonIds(action.evidence_ids_json);
  const selected = source.factors.filter((f) => ids.includes(f.id));
  const evidence = selected.flatMap((f) => f.evidence.filter((e) => evidenceIds.includes(e.id))
    .map((e) => ({ id: e.id, factor: f.code, statement: e.statement, source_type: e.source_type,
      source_detail: e.source_detail, period: e.period })));
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
  let suggestions: Array<{ direction: Direction; score: number; rationale: string; evidence_ids: string[] }>;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", store: false, max_output_tokens: 950,
        instructions: "Eres asistente metodológico de Anima Praxis. Sugiere un borrador de afinidad por separado para costes, diferenciación y enfoque. Escala 0 sin relación, 1 indirecta, 2 significativa, 3 directa. No midas viabilidad ni inventes hechos. Usa solo IDs de evidencia proporcionados. El Equipo de Alto Nivel decide y el consultor revisa.",
        input: JSON.stringify({ action: { quadrant: action.quadrant, statement: action.statement,
          expected_effect: action.expected_effect, priority: action.priority },
          factors: selected.map((f) => ({ code: f.code, description: f.description })), evidence }),
        text: { format: { type: "json_schema", name: "mdep_affinity_draft", strict: true,
          schema: { type: "object", additionalProperties: false, required: ["suggestions"],
            properties: { suggestions: { type: "array", items: { type: "object", additionalProperties: false,
              required: ["direction", "score", "rationale", "evidence_ids"], properties: {
                direction: { type: "string", enum: DIRECTIONS }, score: { type: "integer", enum: [0,1,2,3] },
                rationale: { type: "string" }, evidence_ids: { type: "array", items: { type: "string" } },
              } } } } } } },
      }),
    });
    if (!response.ok) throw new Error(`service_${response.status}`);
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = payload.output?.flatMap((o) => o.content ?? []).find((x) => x.type === "output_text")?.text;
    if (!text) throw new Error("response_empty");
    suggestions = (JSON.parse(text) as { suggestions: typeof suggestions }).suggestions;
    const allowed = new Set(evidence.map((e) => e.id));
    if (!Array.isArray(suggestions) || suggestions.length !== 3 ||
      new Set(suggestions.map((s) => s.direction)).size !== 3 ||
      suggestions.some((s) => !DIRECTIONS.includes(s.direction) || !Number.isInteger(s.score) || s.score < 0 || s.score > 3 ||
        s.rationale.trim().length < 10 || s.rationale.length > 1000 || !Array.isArray(s.evidence_ids) ||
        !s.evidence_ids.length || s.evidence_ids.some((id) => !allowed.has(id)))) throw new Error("response_invalid");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    const category = reason.startsWith("service_") ? "ai_service" :
      reason === "response_empty" || reason === "response_invalid" || error instanceof SyntaxError ? "ai_response" :
      error instanceof Error && error.name === "AbortError" ? "ai_timeout" : "ai";
    console.error("mdep_affinity_ai_draft_failed", { category, reason: reason.startsWith("service_") ? reason : category });
    redirect(`${porterPath}?error=${category}&action=${encodeURIComponent(action.id)}#accion-${encodeURIComponent(action.id)}`);
  } finally { clearTimeout(timer); }
  await bumpMdep(mdep);
  await db.batch([
    db.prepare("INSERT INTO mdep_affinity_drafts (id, assessment_id, action_id, suggestions_json, model) VALUES (?, ?, ?, ?, ?) ON CONFLICT(assessment_id, action_id) DO UPDATE SET suggestions_json = excluded.suggestions_json, model = excluded.model, created_at = CURRENT_TIMESTAMP")
      .bind(crypto.randomUUID(), mdep.id, action.id, JSON.stringify(suggestions), "gpt-4.1-mini"),
    audit(db, actor, cycle.id, "mdep.ai_draft_created", "mdep_assessment", mdep.id,
      { actionId: action.id, suggestions, model: "gpt-4.1-mini", provisional: true, revision: mdep.revision + 1 }),
  ]);
  refresh(); redirect(`${porterPath}?suggested=${encodeURIComponent(action.id)}#accion-${encodeURIComponent(action.id)}`);
}

export async function saveMdepCriterion(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const direction = field(form, "direction") as Direction, key = field(form, "criterion_key"), score = Number(field(form, "score"));
  const scope = field(form, "scope") === "segment" ? "segment" : "general";
  const rationale = field(form, "rationale"), source = field(form, "source_detail");
  if (!DIRECTIONS.includes(direction) || !CRITERIA[direction].some((item) => item.key === key) ||
    (scope === "segment" && direction === "enfoque") ||
    !Number.isInteger(score) || score < 0 || score > 4 || rationale.length < 10 || rationale.length > 1000 ||
    source.length < 8 || source.length > 1000) redirect(`${porterPath}?error=criterion`);
  const previous = (await getCriteria(mdep.id)).find((c) => c.scope === scope && c.direction === direction && c.criterion_key === key);
  await bumpMdep(mdep);
  await db.batch([
    db.prepare("INSERT INTO mdep_criteria (id, assessment_id, scope, direction, criterion_key, score, rationale, source_detail, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(assessment_id, scope, direction, criterion_key) DO UPDATE SET score = excluded.score, rationale = excluded.rationale, source_detail = excluded.source_detail, updated_by_user_id = excluded.updated_by_user_id, version = mdep_criteria.version + 1, updated_at = CURRENT_TIMESTAMP")
      .bind(crypto.randomUUID(), mdep.id, scope, direction, key, score, rationale, source, actor.user.userId),
    audit(db, actor, cycle.id, "mdep.criterion_saved", "mdep_assessment", mdep.id,
      { direction, scope, key, score, rationale, source, previous: previous ?? null, revision: mdep.revision + 1 }),
  ]);
  refresh(); redirect(`${porterPath}?saved=1`);
}

export async function saveMdepCondition(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const direction = field(form, "direction") as Direction, status = field(form, "status");
  const rationale = field(form, "rationale"), source = field(form, "source_detail");
  if (!DIRECTIONS.includes(direction) || !["met", "pending", "unmet"].includes(status) ||
    rationale.length < 10 || rationale.length > 1000 || source.length < 8 || source.length > 1000)
    redirect(`${porterPath}?error=condition`);
  const previous = (await getConditions(mdep.id)).find((c) => c.direction === direction);
  await bumpMdep(mdep);
  await db.batch([
    db.prepare("INSERT INTO mdep_conditions (id, assessment_id, direction, status, rationale, source_detail, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(assessment_id, direction) DO UPDATE SET status = excluded.status, rationale = excluded.rationale, source_detail = excluded.source_detail, updated_by_user_id = excluded.updated_by_user_id, version = mdep_conditions.version + 1, updated_at = CURRENT_TIMESTAMP")
      .bind(crypto.randomUUID(), mdep.id, direction, status, rationale, source, actor.user.userId),
    audit(db, actor, cycle.id, "mdep.condition_saved", "mdep_assessment", mdep.id,
      { direction, status, rationale, source, previous: previous ?? null, revision: mdep.revision + 1 }),
  ]);
  refresh(); redirect(`${porterPath}?saved=1`);
}

export async function saveMdepDirectionBrief(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const direction = field(form, "direction") as Direction;
  const values = ["advantages", "risks", "required_capabilities", "operational_implications", "market_coherence"]
    .map((key) => field(form, key));
  if (!DIRECTIONS.includes(direction) || values.some((v) => v.length < 10 || v.length > 1500))
    redirect(`${porterPath}?error=brief`);
  const previous = (await getDirectionBriefs(mdep.id)).find((b) => b.direction === direction);
  await bumpMdep(mdep);
  await db.batch([
    db.prepare("INSERT INTO mdep_direction_briefs (id, assessment_id, direction, advantages, risks, required_capabilities, operational_implications, market_coherence, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(assessment_id, direction) DO UPDATE SET advantages = excluded.advantages, risks = excluded.risks, required_capabilities = excluded.required_capabilities, operational_implications = excluded.operational_implications, market_coherence = excluded.market_coherence, updated_by_user_id = excluded.updated_by_user_id, version = mdep_direction_briefs.version + 1, updated_at = CURRENT_TIMESTAMP")
      .bind(crypto.randomUUID(), mdep.id, direction, ...values, actor.user.userId),
    audit(db, actor, cycle.id, "mdep.direction_brief_saved", "mdep_assessment", mdep.id,
      { direction, values, previous: previous ?? null, revision: mdep.revision + 1 }),
  ]);
  refresh(); redirect(`${porterPath}?saved=1`);
}

export async function saveMdepContext(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const narrative = field(form, "competitive_context");
  if (narrative.length < 20 || narrative.length > 3000) redirect(`${porterPath}?error=context`);
  await bumpMdep(mdep);
  await db.batch([
    db.prepare("UPDATE mdep_assessments SET competitive_context = ? WHERE id = ?").bind(narrative, mdep.id),
    audit(db, actor, cycle.id, "mdep.context_saved", "mdep_assessment", mdep.id,
      { context: narrative, previous: mdep.competitive_context, revision: mdep.revision + 1 }),
  ]);
  refresh(); redirect(`${porterPath}?saved=1`);
}

export async function saveFocusDetail(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const segment = field(form, "segment"), advantage = field(form, "advantage"), exclusions = field(form, "exclusions");
  if (segment.length < 10 || segment.length > 800 || !["costes", "diferenciacion"].includes(advantage) ||
    exclusions.length < 10 || exclusions.length > 800) redirect(`${porterPath}?error=focus`);
  await bumpMdep(mdep);
  await db.batch([
    db.prepare("UPDATE mdep_assessments SET focus_segment = ?, focus_advantage = ?, focus_exclusions = ? WHERE id = ?")
      .bind(segment, advantage, exclusions, mdep.id),
    audit(db, actor, cycle.id, "mdep.focus_detail_saved", "mdep_assessment", mdep.id,
      { segment, advantage, exclusions, previous: { segment: mdep.focus_segment, advantage: mdep.focus_advantage,
        exclusions: mdep.focus_exclusions }, revision: mdep.revision + 1 }),
  ]);
  refresh(); redirect(`${porterPath}?saved=1`);
}

async function assessmentComplete(mdep: MdepAssessment, actionSetId: string) {
  const [actions, affinities, criteria, conditions, briefs] = await Promise.all([
    getStrategicActions(actionSetId), getAffinities(mdep.id), getCriteria(mdep.id), getConditions(mdep.id), getDirectionBriefs(mdep.id),
  ]);
  const results = DIRECTIONS.map((d) => directionResult(actions.map((a) => ({ id: a.id, priority: a.priority })), affinities.map((a) => ({ action_id: a.action_id, direction: a.direction, score: a.score })),
    criteria.filter((c) => c.scope === "general").map((c) => ({ direction: c.direction, criterion_key: c.criterion_key, score: c.score })),
    conditions.map((c) => ({ direction: c.direction, status: c.status })), d));
  return { results, complete: mdep.competitive_context.length >= 20 &&
    results.every((r) => r.score !== null && conditions.some((c) => c.direction === r.direction) &&
      briefs.some((b) => b.direction === r.direction)) };
}

export async function voteMdep(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  await leader(actor, porterPath);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const { results, complete } = await assessmentComplete(mdep, set.id);
  const direction = field(form, "direction") as Direction, rationale = field(form, "rationale");
  if (!complete || !DIRECTIONS.includes(direction) || !results.find((r) => r.direction === direction)?.eligible ||
    rationale.length < 10 || rationale.length > 1500) redirect(`${porterPath}?error=vote`);
  if ((await getMdepVotes(mdep.id, mdep.revision)).some((v) => v.member_id === actor.memberId)) redirect(`${porterPath}?error=voted`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO mdep_votes (id, assessment_id, assessment_revision, member_id, direction, rationale) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, mdep.id, mdep.revision, actor.memberId, direction, rationale),
    audit(db, actor, cycle.id, "mdep.voted", "mdep_assessment", mdep.id,
      { voteId: id, direction, rationale, revision: mdep.revision }),
  ]);
  refresh(); redirect(`${porterPath}?voted=1`);
}

export async function reviewMdep(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  if (actor.role !== "consultant") redirect(`${porterPath}?error=permission`);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const { complete } = await assessmentComplete(mdep, set.id);
  const votes = await getMdepVotes(mdep.id, mdep.revision);
  const leaders = await getMembers(actor.organizationId!);
  const state = matrixVoteState(votes.map((v) => ({ ...v, matrix_id: v.assessment_id, matrix_revision: v.assessment_revision,
    decision: "validated" as const })), leaders);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!complete || !state.ready || !["approved", "changes_requested"].includes(decision) ||
    rationale.length < 10 || rationale.length > 1500) redirect(`${porterPath}?error=review`);
  const subject = `${mdep.id}:r${mdep.revision}`;
  if (await latestGate(cycle.id, "porter.mdep", subject)) redirect(`${porterPath}?error=review`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, 'porter.mdep', ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, subject, decision, actor.user.userId, rationale,
        JSON.stringify(state.current.map((v) => v.id)), METHODOLOGY_VERSION),
    audit(db, actor, cycle.id, "mdep.reviewed", "mdep_assessment", mdep.id,
      { decision, rationale, voteIds: state.current.map((v) => v.id), revision: mdep.revision }),
  ]);
  refresh(); redirect(`${porterPath}?reviewed=1`);
}

export async function approveMdep(form: FormData) {
  const { actor, cycle, matrix, db } = await context(porterPath);
  const member = await leader(actor, porterPath);
  if (!member.is_director) redirect(`${porterPath}?error=permission`);
  const set = await getActionSet(matrix.id);
  if (!set || set.status !== "approved") redirect(`${porterPath}?error=source`);
  const mdep = await editableMdep(set.id, field(form, "assessment_id"), Number(field(form, "revision")));
  const { results, complete } = await assessmentComplete(mdep, set.id);
  const direction = field(form, "direction") as Direction, rationale = field(form, "rationale");
  if (!complete || !DIRECTIONS.includes(direction) || !results.find((r) => r.direction === direction)?.eligible ||
    rationale.length < 20 || rationale.length > 2000) redirect(`${porterPath}?error=decision`);
  const segmentCriteria = direction === "enfoque" ? (await getCriteria(mdep.id)).filter((c) => c.scope === "segment") : [];
  const segmentScores = direction === "enfoque" ? {
    costes: viabilityScore(segmentCriteria, "costes"),
    diferenciacion: viabilityScore(segmentCriteria, "diferenciacion"),
  } : null;
  if (direction === "enfoque" && (!mdep.focus_segment || !mdep.focus_advantage || !mdep.focus_exclusions ||
    segmentScores?.costes === null || segmentScores?.diferenciacion === null)) redirect(`${porterPath}?error=focus`);
  const votes = await getMdepVotes(mdep.id, mdep.revision);
  const state = matrixVoteState(votes.map((v) => ({ ...v, matrix_id: v.assessment_id, matrix_revision: v.assessment_revision,
    decision: "validated" as const })), await getMembers(actor.organizationId!));
  const review = await latestGate(cycle.id, "porter.mdep", `${mdep.id}:r${mdep.revision}`);
  if (!state.ready || review?.status !== "approved" || !votes.some((v) => v.direction === direction) ||
    JSON.stringify(state.current.map((v) => v.id).sort()) !== JSON.stringify(jsonIds(review.source_ids_json).sort()))
    redirect(`${porterPath}?error=review`);
  const result = await db.prepare("UPDATE mdep_assessments SET status = 'approved', choice_direction = ?, choice_rationale = ?, approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(direction, rationale, actor.user.userId, mdep.id, mdep.revision).run();
  if (result.meta.changes !== 1) redirect(`${porterPath}?error=stale`);
  await audit(db, actor, cycle.id, "mdep.direction_approved", "mdep_assessment", mdep.id,
    { direction, rationale, revision: mdep.revision, reviewId: review.id, voteIds: state.current.map((v) => v.id),
      results, segmentScores, focusAdvantage: mdep.focus_advantage, methodologyVersion: METHODOLOGY_VERSION }).run();
  await progress(cycle.id, "porter", "approved", 100, `Dirección aprobada: ${direction}`, actor.user.userId);
  refresh(); redirect(`${porterPath}?approved=1`);
}
