"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getD1 } from "@/db";
import { getActor } from "@/lib/authz";
import { reviewSourceIds } from "@/lib/sprint6-review-policy.mts";
import { getInitiatives, getObjectives, getApprovedStrategy } from "@/lib/sprint6";
import { getAreaScorecards, getBudgetEntries, getExecutionPlans, getKpiSpecs } from "@/lib/sprint7";
import { finalApprovalInsert } from "@/lib/sprint7-final-guard.mts";
import { getSprint7ReviewState, sprint7Gate } from "@/lib/sprint7-review";
import { getCurrentCycle, getMembers } from "@/lib/workspace";

const path = "/modulos/ejecucion";
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function fail(code: string): never { redirect(`${path}?error=${code}#revision-sprint7`); }
function refresh() { revalidatePath("/"); revalidatePath(path); revalidatePath("/modulos/kpis"); }

async function context() {
  const actor = await getActor();
  if (!actor?.organizationId || !actor.memberId) fail("permission");
  const db = getD1();
  const member = await db.prepare("SELECT role, status, is_leader, is_director FROM members WHERE id = ? AND organization_id = ?")
    .bind(actor.memberId, actor.organizationId).first<{ role: string; status: string; is_leader: number; is_director: number }>();
  if (!member || member.status !== "active") fail("permission");
  const cycle = await getCurrentCycle(actor.organizationId);
  if (!cycle) fail("source");
  const strategy = await getApprovedStrategy(cycle.id);
  if (!strategy) fail("source");
  const [objectives, initiatives, plans, kpis, budgets, areas, members] = await Promise.all([
    getObjectives(strategy.id), getInitiatives(cycle.id), getExecutionPlans(cycle.id), getKpiSpecs(cycle.id),
    getBudgetEntries(cycle.id), getAreaScorecards(cycle.id), getMembers(actor.organizationId),
  ]);
  const state = await getSprint7ReviewState({ cycle, objectives, initiatives, plans, kpis, budgets, areas, members });
  return { actor, member, db, cycle, objectives, initiatives, plans, kpis, budgets, areas, members, state };
}

function auditIf(db: D1Database, ctx: Awaited<ReturnType<typeof context>>, decisionId: string,
  event: string, payload: unknown) {
  return db.prepare("INSERT INTO audit_events (id, organization_id, cycle_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) SELECT ?, ?, ?, ?, ?, ?, 'sprint7_demo_package', ?, ? WHERE EXISTS (SELECT 1 FROM approvals WHERE id = ?)")
    .bind(crypto.randomUUID(), ctx.actor.organizationId, ctx.cycle.id, ctx.actor.user.userId,
      ctx.actor.user.email.toLowerCase(), event, ctx.state.subject, JSON.stringify(payload), decisionId);
}

export async function voteSprint7(form: FormData) {
  const ctx = await context(), { actor, member, db, cycle, state } = ctx;
  if (field(form, "expected_subject") !== state.subject) fail("stale");
  if (!member.is_leader || !["owner", "admin", "leader"].includes(member.role)) fail("permission");
  if (!state.readyForVote || state.votes.current.some((vote) => vote.reviewer_user_id === actor.user.userId))
    fail("review_locked");
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["validated", "doubt", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500)
    fail("invalid");
  const id = crypto.randomUUID();
  const result = await db.batch([
    db.prepare("INSERT OR IGNORE INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, sprint7Gate("vote"), state.subject, decision, actor.user.userId,
        rationale, JSON.stringify(state.tokens), cycle.methodology_version),
    auditIf(db, ctx, id, "sprint7.demo.voted", { decision, rationale, tokens: state.tokens }),
  ]);
  if (result[0].meta.changes !== 1) fail("stale");
  refresh(); redirect(`${path}?voted=1#revision-sprint7`);
}

export async function reviewSprint7(form: FormData) {
  const ctx = await context(), { actor, db, cycle, state } = ctx;
  if (field(form, "expected_subject") !== state.subject) fail("stale");
  if (actor.role !== "consultant") fail("permission");
  if (!state.readyForReview) fail("quorum");
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["approved", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500)
    fail("invalid");
  const voteIds = state.votes.current.map((vote) => vote.id), id = crypto.randomUUID();
  const summary = decision === "approved" ? "Revisión favorable del consultor; decisión del director pendiente."
    : "El consultor solicitó cambios; se requiere una versión revisada y nueva participación.";
  const result = await db.batch([
    db.prepare("INSERT OR IGNORE INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, sprint7Gate("review"), state.subject, decision, actor.user.userId,
        rationale, JSON.stringify(reviewSourceIds(state.tokens, voteIds)), cycle.methodology_version),
    auditIf(db, ctx, id, "sprint7.demo.reviewed", { decision, rationale, voteIds, tokens: state.tokens }),
    ...(["ejecucion", "kpis"] as const).map((slug) =>
      db.prepare("UPDATE module_progress SET percent = ?, summary = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE cycle_id = ? AND module_slug = ? AND status = 'in_progress' AND EXISTS (SELECT 1 FROM approvals WHERE id = ?)")
        .bind(decision === "approved" ? 90 : 20, summary, actor.user.userId, cycle.id, slug, id)),
  ]);
  if (result[0].meta.changes !== 1 || result[2].meta.changes !== 1 || result[3].meta.changes !== 1)
    fail("stale");
  refresh(); redirect(`${path}?reviewed=1#revision-sprint7`);
}

export async function decideSprint7(form: FormData) {
  const ctx = await context(), { actor, member, db, cycle, state } = ctx;
  if (field(form, "expected_subject") !== state.subject) fail("stale");
  if (!member.is_director || !member.is_leader || !["owner", "admin", "leader"].includes(member.role))
    fail("permission");
  if (!state.readyForFinal || !state.review) fail("review_locked");
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["approved", "changes_requested"].includes(decision) || rationale.length < 20 || rationale.length > 2000)
    fail("invalid");
  const id = crypto.randomUUID();
  const sources = JSON.stringify(reviewSourceIds(state.tokens, [state.review.id]));
  if (decision === "changes_requested") {
    const result = await db.batch([
      db.prepare("INSERT OR IGNORE INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, cycle.id, sprint7Gate("final"), state.subject, decision, actor.user.userId,
          rationale, sources, cycle.methodology_version),
      auditIf(db, ctx, id, "sprint7.demo.changes_requested", { rationale, reviewId: state.review.id, tokens: state.tokens }),
      ...(["ejecucion", "kpis"] as const).map((slug) =>
        db.prepare("UPDATE module_progress SET percent = 20, summary = 'Dirección solicitó cambios; se requiere una versión revisada.', updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE cycle_id = ? AND module_slug = ? AND status = 'in_progress' AND EXISTS (SELECT 1 FROM approvals WHERE id = ?)")
          .bind(actor.user.userId, cycle.id, slug, id)),
    ]);
    if (result[0].meta.changes !== 1 || result[2].meta.changes !== 1 || result[3].meta.changes !== 1)
      fail("stale");
    refresh(); redirect(`${path}?changes=1#revision-sprint7`);
  }

  const insert = finalApprovalInsert({ id, cycleId: cycle.id, subject: state.subject,
    reviewerUserId: actor.user.userId, rationale, sourceIdsJson: sources,
    methodologyVersion: cycle.methodology_version, tokens: state.tokens });
  const statements = [
    db.prepare(insert.sql).bind(...insert.values),
    ...(["execution_plans", "kpi_specs", "budget_entries", "area_scorecards"] as const).map((table) =>
      db.prepare(`UPDATE ${table} SET status = 'approved', updated_at = CURRENT_TIMESTAMP
        WHERE cycle_id = ? AND status = 'draft' AND EXISTS (SELECT 1 FROM approvals WHERE id = ? AND status = 'approved')`)
        .bind(cycle.id, id)),
    auditIf(db, ctx, id, "sprint7.demo.approved", { rationale, reviewId: state.review.id,
      voteIds: state.votes.current.map((vote) => vote.id), tokens: state.tokens }),
    ...(["ejecucion", "kpis"] as const).map((slug) =>
      db.prepare(`INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary,
        updated_by_user_id, approved_by_user_id, approved_at)
        SELECT ?, ?, ?, 'approved', 100, ?, ?, ?, CURRENT_TIMESTAMP
        WHERE EXISTS (SELECT 1 FROM approvals WHERE id = ? AND status = 'approved')
        ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = 'approved', percent = 100,
          summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id,
          approved_by_user_id = excluded.approved_by_user_id, approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP`)
        .bind(crypto.randomUUID(), cycle.id, slug,
          "Conjunto ficticio aprobado para demostración comercial; no representa datos de un cliente real.",
          actor.user.userId, actor.user.userId, id)),
  ];
  let result: D1Result[];
  try { result = await db.batch(statements); }
  catch {
    console.error("sprint7.final.db_batch_failed", { cycleId: cycle.id, subject: state.subject });
    fail("final_unavailable");
  }
  if (result[0].meta.changes !== 1 || result[1].meta.changes !== ctx.plans.length ||
    result[2].meta.changes !== ctx.kpis.length || result[3].meta.changes !== ctx.budgets.length ||
    result[4].meta.changes !== ctx.areas.length) fail("stale");
  refresh(); redirect(`${path}?approved=1#revision-sprint7`);
}
