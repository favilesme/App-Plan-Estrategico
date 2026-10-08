"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getD1 } from "@/db";
import { getActor } from "@/lib/authz";
import { duplicateFactorIds, factorIssues, FODA_AXES, latestValidations, quorum, type FodaAxis, type FodaSet } from "@/lib/foda";
import { MAX_FODA_FACTORS_PER_AXIS, METHODOLOGY_VERSION } from "@/lib/methodology";
import { diagnosticSubject, getDiagnosticInputs, isHighLevelMember, latestApproval } from "@/lib/sprint2";
import {
  fodaReviewSubject, getConsultantFodaReview, getFodaEvidence, getFodaFactors,
  getFodaSet, getFodaValidations, getOrCreateFodaSet,
} from "@/lib/sprint3";
import { getCurrentCycle, getMembers } from "@/lib/workspace";

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const axisPath = (axis: string) => axis === "F" || axis === "D" ? "/modulos/analisis-interno" : "/modulos/analisis-externo";
const validSources = ["documento", "entrevista", "reporte_empresa", "otra"];

async function context(returnTo: string) {
  const actor = await getActor();
  if (!actor?.organizationId) redirect(`${returnTo}?error=permission`);
  const cycle = await getCurrentCycle(actor.organizationId);
  if (!cycle) redirect(`${returnTo}?error=cycle`);
  return { actor, cycle, db: getD1() };
}

function audit(db: D1Database, actor: NonNullable<Awaited<ReturnType<typeof getActor>>>, cycleId: string,
  eventType: string, subjectType: string, subjectId: string, payload: unknown) {
  return db.prepare("INSERT INTO audit_events (id, organization_id, cycle_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), actor.organizationId, cycleId, actor.user.userId, actor.user.email.toLowerCase(),
      eventType, subjectType, subjectId, JSON.stringify(payload));
}

async function requireLeader(actor: NonNullable<Awaited<ReturnType<typeof getActor>>>, returnTo: string) {
  if (!actor.organizationId || !(await isHighLevelMember(actor.organizationId, actor.memberId))) redirect(`${returnTo}?error=permission`);
  const member = await getD1().prepare("SELECT is_leader, is_director, status, role FROM members WHERE id = ? AND organization_id = ?")
    .bind(actor.memberId, actor.organizationId).first<{ is_leader: number; is_director: number; status: string; role: string }>();
  if (!member || member.status !== "active" || !member.is_leader || !["owner", "admin", "leader"].includes(member.role)) redirect(`${returnTo}?error=permission`);
  return member;
}

async function reserveRevision(db: D1Database, set: FodaSet, form: FormData, returnTo: string) {
  if (set.status !== "draft") redirect(`${returnTo}?error=frozen`);
  const expected = Number(field(form, "expected_revision"));
  if (!Number.isInteger(expected) || expected !== set.revision) redirect(`${returnTo}?error=stale`);
  const result = await db.prepare("UPDATE foda_sets SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(set.id, expected).run();
  if (result.meta.changes !== 1) redirect(`${returnTo}?error=stale`);
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/modulos/analisis-interno");
  revalidatePath("/modulos/analisis-externo");
  revalidatePath("/modulos/foda");
}

async function updateProgress(cycleId: string, userId: string) {
  const set = await getFodaSet(cycleId);
  if (!set) return;
  const factors = await getFodaFactors(set.id), evidence = await getFodaEvidence(set.id);
  const duplicateIds = duplicateFactorIds(factors);
  for (const [slug, axes] of [["analisis-interno", ["F", "D"]], ["analisis-externo", ["O", "A"]]] as const) {
    const active = factors.filter((item) => axes.includes(item.axis as never) && item.status !== "discarded");
    const represented = axes.filter((axis) => active.some((item) => item.axis === axis)).length;
    const ready = represented === 2 && active.every((item) => item.status !== "needs_clarification" &&
      !duplicateIds.has(item.id) && evidence.some((entry) => entry.factor_id === item.id)) &&
      axes.every((axis) => active.filter((item) => item.axis === axis).length <= MAX_FODA_FACTORS_PER_AXIS);
    const percent = represented * 25 + Number(ready) * 25 + Number(set.status === "frozen") * 25;
    const summary = `${axes.map((axis) => `${axis} ${active.filter((item) => item.axis === axis).length}`).join(" · ")} · ${set.status === "frozen" ? `lista aprobada v${set.version}` : "lista en revisión"}`;
    await getD1().prepare("INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = excluded.status, percent = excluded.percent, summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
      .bind(crypto.randomUUID(), cycleId, slug, set.status === "frozen" ? "approved" : "in_progress", percent, summary, userId).run();
  }
}

export async function saveFodaFactor(form: FormData) {
  const axis = field(form, "axis") as FodaAxis;
  const path = axisPath(axis);
  const { actor, cycle, db } = await context(path);
  await requireLeader(actor, path);
  if (!FODA_AXES.includes(axis)) redirect(`${path}?error=invalid`);
  const id = field(form, "id");
  const description = field(form, "description"), area = field(form, "area"), reason = field(form, "classification_reason");
  if (description.length < 8 || description.length > 500 || area.length < 2 || area.length > 120 || reason.length < 10 || reason.length > 1000) redirect(`${path}?error=invalid`);
  const set = await getOrCreateFodaSet(cycle.id);
  const prior = id ? await db.prepare("SELECT * FROM foda_factors WHERE id = ? AND set_id = ?").bind(id, set.id).first<Record<string, unknown>>() : null;
  if (id && !prior) redirect(`${path}?error=missing`);
  if (prior && (prior.axis !== axis || Number(field(form, "expected_version")) !== Number(prior.version))) redirect(`${path}?error=stale`);
  let evidenceInput: { type: string; statement: string; source: string; detail: string; period: string; diagnosticId: string } | null = null;
  if (!prior) {
    evidenceInput = { type: field(form, "evidence_type"), statement: field(form, "evidence_statement"),
      source: field(form, "source_type"), detail: field(form, "source_detail"),
      period: field(form, "period"), diagnosticId: field(form, "diagnostic_input_id") };
    if (!["quantitative", "qualitative"].includes(evidenceInput.type) || evidenceInput.statement.length < 8 ||
      evidenceInput.statement.length > 1500 || !validSources.includes(evidenceInput.source) ||
      evidenceInput.detail.length < 3 || evidenceInput.detail.length > 500 ||
      evidenceInput.period.length < 2 || evidenceInput.period.length > 120) redirect(`${path}?error=evidence`);
    if (evidenceInput.diagnosticId) {
      const diagnostic = (await getDiagnosticInputs(cycle.id)).find((item) => item.id === evidenceInput?.diagnosticId);
      if (!diagnostic || diagnostic.classification !== "dato" || !diagnostic.source_detail) redirect(`${path}?error=evidence`);
    }
  }
  if (prior && prior.description === description && prior.area === area && prior.classification_reason === reason && prior.status === "proposed") redirect(`${path}?saved=1`);
  await reserveRevision(db, set, form, path);
  const factorId = id || crypto.randomUUID();
  if (prior) {
    const change = await db.prepare("UPDATE foda_factors SET description = ?, area = ?, classification_reason = ?, status = 'proposed', version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND set_id = ? AND version = ?")
      .bind(description, area, reason, actor.user.userId, id, set.id, Number(prior.version)).run();
    if (change.meta.changes !== 1) redirect(`${path}?error=stale`);
    await audit(db, actor, cycle.id, "foda.factor_updated", "foda_factor", id, { previous: prior, current: { description, area, reason }, setVersion: set.version }).run();
  } else {
    const next = await db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM foda_factors WHERE cycle_id = ? AND axis = ?")
      .bind(cycle.id, axis).first<{ value: number }>();
    const sequence = next?.value ?? 1, code = `${axis}${sequence}`;
    const evidenceId = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO foda_factors (id, set_id, cycle_id, axis, code, sequence, description, area, classification_reason, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(factorId, set.id, cycle.id, axis, code, sequence, description, area, reason, actor.user.userId, actor.user.userId),
      db.prepare("INSERT INTO foda_evidence (id, factor_id, evidence_type, statement, source_type, source_detail, period, diagnostic_input_id, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(evidenceId, factorId, evidenceInput!.type, evidenceInput!.statement, evidenceInput!.source,
          evidenceInput!.detail, evidenceInput!.period, evidenceInput!.diagnosticId || null, actor.user.userId, actor.user.userId),
      audit(db, actor, cycle.id, "foda.factor_created", "foda_factor", factorId,
        { code, description, area, reason, evidenceId, evidence: evidenceInput, setVersion: set.version }),
    ]);
  }
  await updateProgress(cycle.id, actor.user.userId); refresh(); redirect(`${path}?saved=1`);
}

export async function saveFodaEvidence(form: FormData) {
  const path = axisPath(field(form, "axis"));
  const { actor, cycle, db } = await context(path);
  await requireLeader(actor, path);
  const set = await getFodaSet(cycle.id), factorId = field(form, "factor_id"), evidenceId = field(form, "id");
  if (!set) redirect(`${path}?error=missing`);
  const factor = await db.prepare("SELECT id, axis, status FROM foda_factors WHERE id = ? AND set_id = ?").bind(factorId, set.id).first<{ id: string; axis: string; status: string }>();
  if (!factor || axisPath(factor.axis) !== path || factor.status === "discarded") redirect(`${path}?error=missing`);
  const type = field(form, "evidence_type"), statement = field(form, "evidence_statement"), source = field(form, "source_type");
  const detail = field(form, "source_detail"), period = field(form, "period"), diagnosticId = field(form, "diagnostic_input_id");
  if (!["quantitative", "qualitative"].includes(type) || statement.length < 8 || statement.length > 1500 ||
    !validSources.includes(source) || detail.length < 3 || detail.length > 500 || period.length < 2 || period.length > 120) redirect(`${path}?error=evidence`);
  if (diagnosticId) {
    const diagnostic = (await getDiagnosticInputs(cycle.id)).find((item) => item.id === diagnosticId);
    if (!diagnostic || diagnostic.classification !== "dato" || !diagnostic.source_detail) redirect(`${path}?error=evidence`);
  }
  const prior = evidenceId ? await db.prepare("SELECT * FROM foda_evidence WHERE id = ? AND factor_id = ?").bind(evidenceId, factorId).first<Record<string, unknown>>() : null;
  if (evidenceId && !prior) redirect(`${path}?error=missing`);
  if (prior && Number(field(form, "expected_version")) !== Number(prior.version)) redirect(`${path}?error=stale`);
  await reserveRevision(db, set, form, path);
  const id = evidenceId || crypto.randomUUID();
  if (prior) {
    const change = await db.prepare("UPDATE foda_evidence SET evidence_type = ?, statement = ?, source_type = ?, source_detail = ?, period = ?, diagnostic_input_id = ?, version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND factor_id = ? AND version = ?")
      .bind(type, statement, source, detail, period, diagnosticId || null, actor.user.userId, id, factorId, Number(prior.version)).run();
    if (change.meta.changes !== 1) redirect(`${path}?error=stale`);
  } else {
    await db.prepare("INSERT INTO foda_evidence (id, factor_id, evidence_type, statement, source_type, source_detail, period, diagnostic_input_id, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, factorId, type, statement, source, detail, period, diagnosticId || null, actor.user.userId, actor.user.userId).run();
  }
  await audit(db, actor, cycle.id, "foda.evidence_saved", "foda_evidence", id,
    { factorId, previous: prior, current: { type, statement, source, detail, period, diagnosticId }, setVersion: set.version }).run();
  await updateProgress(cycle.id, actor.user.userId); refresh(); redirect(`${path}?saved=1#${factorId}`);
}

export async function changeFodaFactorStatus(form: FormData) {
  const path = axisPath(field(form, "axis"));
  const { actor, cycle, db } = await context(path);
  await requireLeader(actor, path);
  const set = await getFodaSet(cycle.id), id = field(form, "factor_id"), status = field(form, "status"), reason = field(form, "reason");
  if (!set || !["proposed", "needs_clarification", "discarded"].includes(status) || reason.length < 10 || reason.length > 1000) redirect(`${path}?error=invalid`);
  const factor = await db.prepare("SELECT id, axis, version, status FROM foda_factors WHERE id = ? AND set_id = ?").bind(id, set.id).first<{ id: string; axis: string; version: number; status: string }>();
  if (!factor || axisPath(factor.axis) !== path) redirect(`${path}?error=missing`);
  if (factor.version !== Number(field(form, "expected_version"))) redirect(`${path}?error=stale`);
  if (factor.status === status) redirect(`${path}?saved=1`);
  await reserveRevision(db, set, form, path);
  const change = await db.prepare("UPDATE foda_factors SET status = ?, version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND set_id = ? AND version = ?")
    .bind(status, actor.user.userId, id, set.id, factor.version).run();
  if (change.meta.changes !== 1) redirect(`${path}?error=stale`);
  await audit(db, actor, cycle.id, "foda.factor_status_changed", "foda_factor", id,
    { before: factor.status, after: status, reason, setVersion: set.version }).run();
  await updateProgress(cycle.id, actor.user.userId); refresh(); redirect(`${path}?saved=1#${id}`);
}

export async function validateFodaSet(form: FormData) {
  const path = "/modulos/foda";
  const { actor, cycle, db } = await context(path);
  await requireLeader(actor, path);
  const set = await getFodaSet(cycle.id);
  if (!set || set.status !== "draft") redirect(`${path}?error=frozen`);
  if (set.revision !== Number(field(form, "expected_revision"))) redirect(`${path}?error=stale`);
  const factors = await getFodaFactors(set.id), evidence = await getFodaEvidence(set.id);
  if (factorIssues(factors, evidence).length) redirect(`${path}?error=incomplete`);
  if (await getConsultantFodaReview(set)) redirect(`${path}?error=review_locked`);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["validated", "doubt", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500) redirect(`${path}?error=invalid`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO foda_validations (id, set_id, set_version, revision, member_id, decision, rationale) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, set.id, set.version, set.revision, actor.memberId, decision, rationale),
    audit(db, actor, cycle.id, "foda.list_validated", "foda_set", set.id,
      { version: set.version, revision: set.revision, decision, rationale, validationId: id }),
  ]);
  refresh(); redirect(`${path}?validated=1`);
}

export async function reviewFodaDoubt(form: FormData) {
  const path = "/modulos/foda";
  const { actor, cycle, db } = await context(path);
  if (actor.role !== "consultant") redirect(`${path}?error=permission`);
  const set = await getFodaSet(cycle.id);
  if (!set || set.status !== "draft" || set.revision !== Number(field(form, "expected_revision"))) redirect(`${path}?error=stale`);
  const factors = await getFodaFactors(set.id), evidence = await getFodaEvidence(set.id);
  if (factorIssues(factors, evidence).length) redirect(`${path}?error=incomplete`);
  const diagnostic = await getDiagnosticInputs(cycle.id);
  const diagnosticKey = diagnosticSubject(diagnostic);
  if ((await latestApproval(cycle.id, "diagnostic.review", diagnosticKey))?.status !== "approved") redirect(`${path}?error=diagnostic`);
  const votes = latestValidations(await getFodaValidations(set));
  const q = quorum(votes, await getMembers(actor.organizationId!));
  if (!q.ready || !q.hasDoubt || await getConsultantFodaReview(set)) redirect(`${path}?error=review_unavailable`);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["approved", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500) redirect(`${path}?error=invalid`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, 'foda.doubt', ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, fodaReviewSubject(set), decision, actor.user.userId, rationale, JSON.stringify(q.current.map((item) => item.id)), METHODOLOGY_VERSION),
    audit(db, actor, cycle.id, "foda.doubt_reviewed", "foda_set", set.id,
      { version: set.version, revision: set.revision, decision, rationale, validationIds: q.current.map((item) => item.id) }),
  ]);
  refresh(); redirect(`${path}?reviewed=1`);
}

export async function freezeFodaSet(form: FormData) {
  const path = "/modulos/foda";
  const { actor, cycle, db } = await context(path);
  const director = await requireLeader(actor, path);
  if (!director.is_director) redirect(`${path}?error=permission`);
  const set = await getFodaSet(cycle.id);
  if (!set || set.status !== "draft" || set.revision !== Number(field(form, "expected_revision"))) redirect(`${path}?error=stale`);
  const factors = await getFodaFactors(set.id), evidence = await getFodaEvidence(set.id);
  if (factorIssues(factors, evidence).length) redirect(`${path}?error=incomplete`);
  const diagnostic = await getDiagnosticInputs(cycle.id);
  const diagnosticKey = diagnosticSubject(diagnostic);
  if ((await latestApproval(cycle.id, "diagnostic.review", diagnosticKey))?.status !== "approved") redirect(`${path}?error=diagnostic`);
  const votes = latestValidations(await getFodaValidations(set));
  const q = quorum(votes, await getMembers(actor.organizationId!));
  if (!q.ready) redirect(`${path}?error=quorum`);
  const review = await getConsultantFodaReview(set);
  if (q.hasDoubt && review?.status !== "approved") redirect(`${path}?error=doubt`);
  if (review?.status === "changes_requested") redirect(`${path}?error=doubt`);
  if (q.hasDoubt && JSON.stringify([...q.current.map((item) => item.id)].sort()) !==
      JSON.stringify([...(JSON.parse(review!.source_ids_json) as string[])].sort())) redirect(`${path}?error=doubt`);
  const snapshotId = crypto.randomUUID();
  const frozenFactors = factors.map((item) => ({ ...item, status: item.status === "discarded" ? "discarded" : "approved" }));
  const snapshot = { setId: set.id, version: set.version, revision: set.revision, diagnosticSubject: diagnosticKey,
    factors: frozenFactors.map((factor) => ({ ...factor, evidence: evidence.filter((item) => item.factor_id === factor.id) })),
    validation: q.current, consultantReview: review ?? null };
  const result = await db.prepare("UPDATE foda_sets SET status = 'frozen', frozen_at = CURRENT_TIMESTAMP, frozen_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(actor.user.userId, set.id, set.revision).run();
  if (result.meta.changes !== 1) redirect(`${path}?error=stale`);
  await db.batch([
    db.prepare("UPDATE foda_factors SET status = 'approved' WHERE set_id = ? AND status = 'proposed'").bind(set.id),
    db.prepare("INSERT INTO foda_set_snapshots (id, set_id, version, snapshot_json, validation_ids_json, consultant_approval_id, methodology_version, frozen_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(snapshotId, set.id, set.version, JSON.stringify(snapshot), JSON.stringify(q.current.map((item) => item.id)), review?.id ?? null, METHODOLOGY_VERSION, actor.user.userId),
    audit(db, actor, cycle.id, "foda.list_frozen", "foda_set", set.id,
      { version: set.version, revision: set.revision, snapshotId, factors: frozenFactors.filter((item) => item.status === "approved").map((item) => `${item.code}:v${item.version}`), validationIds: q.current.map((item) => item.id), consultantReviewId: review?.id ?? null }),
  ]);
  await updateProgress(cycle.id, actor.user.userId); refresh(); redirect(`${path}?frozen=1`);
}

export async function reopenFodaSet(form: FormData) {
  const path = "/modulos/foda";
  const { actor, cycle, db } = await context(path);
  const director = await requireLeader(actor, path);
  if (!director.is_director) redirect(`${path}?error=permission`);
  const set = await getFodaSet(cycle.id), reason = field(form, "reason");
  if (!set || set.status !== "frozen" || set.version !== Number(field(form, "expected_version"))) redirect(`${path}?error=stale`);
  if (reason.length < 10 || reason.length > 1500) redirect(`${path}?error=invalid`);
  await db.batch([
    db.prepare("UPDATE foda_sets SET version = version + 1, revision = 0, status = 'draft', frozen_at = NULL, frozen_by_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'frozen' AND version = ?")
      .bind(set.id, set.version),
    db.prepare("UPDATE foda_factors SET status = 'proposed' WHERE set_id = ? AND status = 'approved'").bind(set.id),
    audit(db, actor, cycle.id, "foda.list_reopened", "foda_set", set.id,
      { previousVersion: set.version, newVersion: set.version + 1, reason }),
  ]);
  await updateProgress(cycle.id, actor.user.userId); refresh(); redirect(`${path}?reopened=1`);
}
