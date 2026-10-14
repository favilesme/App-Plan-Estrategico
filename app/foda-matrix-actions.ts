"use server";

import { env } from "cloudflare:workers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getD1 } from "@/db";
import { getActor } from "@/lib/authz";
import { type FodaSet } from "@/lib/foda";
import { CROSS_SCORES, VULNERABILITY_LEVELS, matrixPairs, matrixVoteState, quadrantResults,
  type CrossScoreValue, type FrozenFoda, type MatrixVersion, type QuantifiedQuadrant, type VulnerabilityLevel } from "@/lib/foda-matrix";
import { METHODOLOGY_VERSION } from "@/lib/methodology";
import { isHighLevelMember } from "@/lib/sprint2";
import { getFodaSet, getFodaSnapshots } from "@/lib/sprint3";
import { getMatrixReview, getMatrixScores, getMatrixSource, getMatrixVersion, getMatrixVersions,
  getMatrixVotes, getQualitativeNotes, getVulnerabilities, matrixReviewSubject } from "@/lib/sprint4";
import { getCurrentCycle, getMembers } from "@/lib/workspace";

const path = "/modulos/foda/matriz";
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

async function context() {
  const actor = await getActor();
  if (!actor?.organizationId) redirect(`${path}?error=permission`);
  const cycle = await getCurrentCycle(actor.organizationId);
  if (!cycle) redirect(`${path}?error=cycle`);
  const set = await getFodaSet(cycle.id);
  if (!set) redirect(`${path}?error=source`);
  return { actor, cycle, set, db: getD1() };
}

async function leader(actor: NonNullable<Awaited<ReturnType<typeof getActor>>>) {
  if (!actor.organizationId || !actor.memberId || !(await isHighLevelMember(actor.organizationId, actor.memberId)))
    redirect(`${path}?error=permission`);
  const member = await getD1().prepare("SELECT is_leader, is_director, status, role FROM members WHERE id = ? AND organization_id = ?")
    .bind(actor.memberId, actor.organizationId).first<{ is_leader: number; is_director: number; status: string; role: string }>();
  if (!member || !member.is_leader || member.status !== "active" || !["owner", "admin", "leader"].includes(member.role))
    redirect(`${path}?error=permission`);
  return member;
}

async function editableMatrix(set: FodaSet, matrixId: string, expectedRevision: number) {
  const matrix = await getMatrixVersion(matrixId, set.id);
  if (!matrix || matrix.status !== "draft" || set.status !== "frozen" || matrix.set_version !== set.version ||
      matrix.revision !== expectedRevision) redirect(`${path}?error=stale`);
  const source = await getMatrixSource(matrix.source_snapshot_id);
  if (!source || source.record.set_id !== set.id || source.record.version !== set.version)
    redirect(`${path}?error=source`);
  return { matrix, source: source.data };
}

function audit(db: D1Database, actor: NonNullable<Awaited<ReturnType<typeof getActor>>>, cycleId: string,
  eventType: string, subjectType: string, subjectId: string, payload: unknown) {
  return db.prepare("INSERT INTO audit_events (id, organization_id, cycle_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), actor.organizationId, cycleId, actor.user.userId, actor.user.email.toLowerCase(),
      eventType, subjectType, subjectId, JSON.stringify(payload));
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/modulos/foda");
  revalidatePath(path);
}

async function updateProgress(cycleId: string, matrix: MatrixVersion, userId: string) {
  const source = await getMatrixSource(matrix.source_snapshot_id);
  if (!source) return;
  const scores = await getMatrixScores(matrix.id);
  const fo = quadrantResults(source.data, "FO", scores), da = quadrantResults(source.data, "DA", scores);
  const total = fo.expected + da.expected;
  const completed = fo.completed + da.completed;
  const percent = matrix.status === "approved" ? 100 : total ? Math.round(80 * completed / total) : 0;
  const summary = `FO ${fo.completed}/${fo.expected} · DA ${da.completed}/${da.expected} · matriz v${matrix.matrix_version}${matrix.status === "approved" ? " aprobada" : " en revisión"}`;
  await getD1().prepare("INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary, updated_by_user_id, approved_by_user_id, approved_at) VALUES (?, ?, 'foda', ?, ?, ?, ?, ?, ?) ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = excluded.status, percent = excluded.percent, summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id, approved_by_user_id = excluded.approved_by_user_id, approved_at = excluded.approved_at, updated_at = CURRENT_TIMESTAMP")
    .bind(crypto.randomUUID(), cycleId, matrix.status === "approved" ? "approved" : "in_progress", percent, summary,
      userId, matrix.approved_by_user_id, matrix.approved_at).run();
}

async function supplementaryComplete(matrixId: string, source: FrozenFoda, scores: Awaited<ReturnType<typeof getMatrixScores>>) {
  const notes = await getQualitativeNotes(matrixId);
  if (!notes.some((item) => item.quadrant === "FA") || !notes.some((item) => item.quadrant === "DO")) return false;
  const priorityWeaknessIds = quadrantResults(source, "DA", scores).internal
    .filter((item) => item.priority === "P1").map((item) => item.factor.id);
  const vulnerabilities = await getVulnerabilities(matrixId);
  return priorityWeaknessIds.every((id) => vulnerabilities.some((item) => item.weakness_factor_id === id));
}

export async function startFodaMatrix() {
  const { actor, cycle, set, db } = await context();
  await leader(actor);
  if (set.status !== "frozen") redirect(`${path}?error=source`);
  const snapshots = await getFodaSnapshots(set.id);
  const snapshot = snapshots.find((item) => item.version === set.version);
  if (!snapshot) redirect(`${path}?error=source`);
  const existing = (await getMatrixVersions(set.id)).find((item) => item.set_version === set.version);
  if (existing) redirect(`${path}?matrix=${existing.id}`);
  const id = crypto.randomUUID();
  await db.prepare("INSERT OR IGNORE INTO foda_matrix_versions (id, set_id, set_version, matrix_version, source_snapshot_id, created_by_user_id) VALUES (?, ?, ?, 1, ?, ?)")
    .bind(id, set.id, set.version, snapshot.id, actor.user.userId).run();
  const matrix = (await getMatrixVersions(set.id)).find((item) => item.set_version === set.version);
  if (!matrix) redirect(`${path}?error=source`);
  if (matrix.id === id) await audit(db, actor, cycle.id, "foda.matrix_started", "foda_matrix", id,
    { setVersion: set.version, sourceSnapshotId: snapshot.id, methodologyVersion: METHODOLOGY_VERSION }).run();
  await updateProgress(cycle.id, matrix, actor.user.userId); refresh(); redirect(`${path}?matrix=${matrix.id}`);
}

export async function suggestFodaCross(form: FormData) {
  const { actor, cycle, set, db } = await context();
  await leader(actor);
  const { matrix, source } = await editableMatrix(set, field(form, "matrix_id"), Number(field(form, "expected_revision")));
  const quadrant = field(form, "quadrant") as QuantifiedQuadrant;
  if (quadrant !== "FO" && quadrant !== "DA") redirect(`${path}?matrix=${matrix.id}&error=score`);
  const internalId = field(form, "internal_factor_id"), externalId = field(form, "external_factor_id");
  const pair = matrixPairs(source, quadrant).find((item) => item.internal.id === internalId && item.external.id === externalId);
  if (!pair) redirect(`${path}?matrix=${matrix.id}&error=source`);
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) redirect(`${path}?matrix=${matrix.id}&quadrant=${quadrant}&pair=${internalId}:${externalId}&error=ai_unavailable`);
  const evidence = [...pair.internal.evidence, ...pair.external.evidence];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let suggestion: { score: number; rationale: string; evidence_ids: string[] };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini", store: false, max_output_tokens: 450,
        instructions: "Eres un asistente metodológico de Anima Praxis. Propón solo un borrador de puntuación para el cruce FO o DA. Aplica 0=sin relación, 1=baja, 3=media, 9=alta. No inventes hechos; cita solo IDs de evidencia proporcionados. Explica el impacto potencial en una frase. El Equipo de Alto Nivel decide la puntuación final.",
        input: JSON.stringify({ quadrant, internal: { code: pair.internal.code, description: pair.internal.description },
          external: { code: pair.external.code, description: pair.external.description },
          evidence: evidence.map((item) => ({ id: item.id, factor_id: item.factor_id,
            statement: item.statement, source_type: item.source_type, source_detail: item.source_detail, period: item.period })) }),
        text: { format: { type: "json_schema", name: "foda_cross_suggestion", strict: true,
          schema: { type: "object", additionalProperties: false, required: ["score", "rationale", "evidence_ids"],
            properties: { score: { type: "integer", enum: [0, 1, 3, 9] },
              rationale: { type: "string" }, evidence_ids: { type: "array", items: { type: "string" } } } } } },
      }),
    });
    if (!response.ok) throw new Error("AI request failed");
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const content = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!content) throw new Error("AI response empty");
    suggestion = JSON.parse(content) as typeof suggestion;
    const allowed = new Set(evidence.map((item) => item.id));
    if (!CROSS_SCORES.includes(suggestion.score as CrossScoreValue) || suggestion.rationale.trim().length < 10 ||
        suggestion.rationale.length > 1500 || !Array.isArray(suggestion.evidence_ids) ||
        suggestion.evidence_ids.length === 0 || suggestion.evidence_ids.some((id) => !allowed.has(id)))
      throw new Error("AI response invalid");
  } catch {
    redirect(`${path}?matrix=${matrix.id}&quadrant=${quadrant}&pair=${internalId}:${externalId}&error=ai`);
  } finally { clearTimeout(timeout); }
  const reserved = await db.prepare("UPDATE foda_matrix_versions SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(matrix.id, matrix.revision).run();
  if (reserved.meta.changes !== 1) redirect(`${path}?matrix=${matrix.id}&error=stale`);
  const scoreId = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO foda_cross_scores (id, matrix_id, quadrant, internal_factor_id, external_factor_id, suggested_score, suggested_rationale, suggested_evidence_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(matrix_id, quadrant, internal_factor_id, external_factor_id) DO UPDATE SET suggested_score = excluded.suggested_score, suggested_rationale = excluded.suggested_rationale, suggested_evidence_ids_json = excluded.suggested_evidence_ids_json, version = foda_cross_scores.version + 1, updated_at = CURRENT_TIMESTAMP")
      .bind(scoreId, matrix.id, quadrant, internalId, externalId, suggestion.score,
        suggestion.rationale.trim(), JSON.stringify(suggestion.evidence_ids)),
    audit(db, actor, cycle.id, "foda.ai_suggestion_created", "foda_matrix", matrix.id,
      { quadrant, internalId, externalId, score: suggestion.score, rationale: suggestion.rationale.trim(),
        evidenceIds: suggestion.evidence_ids, model: "gpt-4.1-mini", provisional: true, matrixRevision: matrix.revision + 1 }),
  ]);
  refresh(); redirect(`${path}?matrix=${matrix.id}&quadrant=${quadrant}&pair=${internalId}:${externalId}&suggested=1`);
}

export async function saveFodaCross(form: FormData) {
  const { actor, cycle, set, db } = await context();
  await leader(actor);
  const matrixId = field(form, "matrix_id"), expectedRevision = Number(field(form, "expected_revision"));
  const { matrix, source } = await editableMatrix(set, matrixId, expectedRevision);
  const quadrant = field(form, "quadrant") as QuantifiedQuadrant;
  if (quadrant !== "FO" && quadrant !== "DA") redirect(`${path}?error=score`);
  const internalId = field(form, "internal_factor_id"), externalId = field(form, "external_factor_id");
  const pair = matrixPairs(source, quadrant).find((item) => item.internal.id === internalId && item.external.id === externalId);
  if (!pair) redirect(`${path}?error=source`);
  const rawScore = field(form, "score");
  const score = Number(rawScore) as CrossScoreValue;
  const rationale = field(form, "rationale");
  const evidenceIds = [...new Set(form.getAll("evidence_id").map((item) => String(item)))];
  const allowedEvidence = new Set([...pair.internal.evidence, ...pair.external.evidence].map((item) => item.id));
  if (!rawScore || !CROSS_SCORES.includes(score) || rationale.length < 10 || rationale.length > 1500 ||
      evidenceIds.length === 0 || evidenceIds.some((id) => !allowedEvidence.has(id)))
    redirect(`${path}?matrix=${matrix.id}&quadrant=${quadrant}&error=score`);
  const suggestion = await db.prepare("SELECT suggested_score FROM foda_cross_scores WHERE matrix_id = ? AND quadrant = ? AND internal_factor_id = ? AND external_factor_id = ?")
    .bind(matrix.id, quadrant, internalId, externalId).first<{ suggested_score: number | null }>();
  if (!suggestion || !CROSS_SCORES.includes(suggestion.suggested_score as CrossScoreValue))
    redirect(`${path}?matrix=${matrix.id}&quadrant=${quadrant}&pair=${internalId}:${externalId}&error=suggestion_required`);
  const existing = await db.prepare("SELECT id, final_score, final_rationale, final_evidence_ids_json, version FROM foda_cross_scores WHERE matrix_id = ? AND quadrant = ? AND internal_factor_id = ? AND external_factor_id = ?")
    .bind(matrix.id, quadrant, internalId, externalId).first<{ id: string; final_score: number | null; final_rationale: string | null; final_evidence_ids_json: string; version: number }>();
  if (existing && existing.final_score === score && existing.final_rationale === rationale &&
      existing.final_evidence_ids_json === JSON.stringify(evidenceIds))
    redirect(`${path}?matrix=${matrix.id}&quadrant=${quadrant}&saved=1`);
  const reserved = await db.prepare("UPDATE foda_matrix_versions SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(matrix.id, expectedRevision).run();
  if (reserved.meta.changes !== 1) redirect(`${path}?error=stale`);
  const id = existing?.id ?? crypto.randomUUID();
  await db.batch([
    existing
      ? db.prepare("UPDATE foda_cross_scores SET final_score = ?, final_rationale = ?, final_evidence_ids_json = ?, updated_by_user_id = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND matrix_id = ?")
        .bind(score, rationale, JSON.stringify(evidenceIds), actor.user.userId, id, matrix.id)
      : db.prepare("INSERT INTO foda_cross_scores (id, matrix_id, quadrant, internal_factor_id, external_factor_id, final_score, final_rationale, final_evidence_ids_json, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, matrix.id, quadrant, internalId, externalId, score, rationale, JSON.stringify(evidenceIds), actor.user.userId),
    audit(db, actor, cycle.id, "foda.cross_scored", "foda_cross", id,
      { matrixId: matrix.id, matrixVersion: matrix.matrix_version, matrixRevision: expectedRevision + 1,
        quadrant, internalFactorId: internalId, externalFactorId: externalId, previous: existing,
        finalScore: score, rationale, evidenceIds }),
  ]);
  await updateProgress(cycle.id, { ...matrix, revision: expectedRevision + 1 }, actor.user.userId);
  refresh(); redirect(`${path}?matrix=${matrix.id}&quadrant=${quadrant}&saved=1`);
}

export async function saveFodaQualitativeNote(form: FormData) {
  const { actor, cycle, set, db } = await context();
  await leader(actor);
  const { matrix, source } = await editableMatrix(set, field(form, "matrix_id"), Number(field(form, "expected_revision")));
  const quadrant = field(form, "quadrant");
  if (quadrant !== "FA" && quadrant !== "DO") redirect(`${path}?matrix=${matrix.id}&error=note`);
  const narrative = field(form, "narrative");
  const factorIds = [...new Set(form.getAll("factor_id").map((item) => String(item)))];
  const internalAxis = quadrant === "FA" ? "F" : "D";
  const externalAxis = quadrant === "FA" ? "A" : "O";
  const eligible = source.factors.filter((item) => item.status === "approved" &&
    (item.axis === internalAxis || item.axis === externalAxis));
  if (narrative.length < 20 || narrative.length > 2000 || factorIds.some((id) => !eligible.some((item) => item.id === id)) ||
      !factorIds.some((id) => eligible.some((item) => item.id === id && item.axis === internalAxis)) ||
      !factorIds.some((id) => eligible.some((item) => item.id === id && item.axis === externalAxis)))
    redirect(`${path}?matrix=${matrix.id}&error=note`);
  const prior = await db.prepare("SELECT id, narrative, factor_ids_json FROM foda_qualitative_notes WHERE matrix_id = ? AND quadrant = ?")
    .bind(matrix.id, quadrant).first<{ id: string; narrative: string; factor_ids_json: string }>();
  if (prior?.narrative === narrative && prior.factor_ids_json === JSON.stringify(factorIds))
    redirect(`${path}?matrix=${matrix.id}&saved=1#zona-${quadrant}`);
  const reserved = await db.prepare("UPDATE foda_matrix_versions SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(matrix.id, matrix.revision).run();
  if (reserved.meta.changes !== 1) redirect(`${path}?matrix=${matrix.id}&error=stale`);
  const id = prior?.id ?? crypto.randomUUID();
  await db.batch([
    prior
      ? db.prepare("UPDATE foda_qualitative_notes SET narrative = ?, factor_ids_json = ?, updated_by_user_id = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND matrix_id = ?")
        .bind(narrative, JSON.stringify(factorIds), actor.user.userId, id, matrix.id)
      : db.prepare("INSERT INTO foda_qualitative_notes (id, matrix_id, quadrant, narrative, factor_ids_json, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, matrix.id, quadrant, narrative, JSON.stringify(factorIds), actor.user.userId),
    audit(db, actor, cycle.id, "foda.qualitative_note_saved", "foda_qualitative_note", id,
      { matrixId: matrix.id, quadrant, prior, narrative, factorIds, matrixRevision: matrix.revision + 1 }),
  ]);
  refresh(); redirect(`${path}?matrix=${matrix.id}&saved=1#zona-${quadrant}`);
}

export async function saveFodaVulnerability(form: FormData) {
  const { actor, cycle, set, db } = await context();
  await leader(actor);
  const { matrix, source } = await editableMatrix(set, field(form, "matrix_id"), Number(field(form, "expected_revision")));
  const scores = await getMatrixScores(matrix.id);
  const da = quadrantResults(source, "DA", scores);
  if (!da.complete) redirect(`${path}?matrix=${matrix.id}&error=incomplete`);
  const weaknessId = field(form, "weakness_factor_id");
  const weakness = da.internal.find((item) => item.factor.id === weaknessId && item.priority === "P1")?.factor;
  const impact = field(form, "impact") as VulnerabilityLevel;
  const probability = field(form, "probability") as VulnerabilityLevel;
  const actionCapacity = field(form, "action_capacity") as VulnerabilityLevel;
  const rationale = field(form, "rationale");
  const evidenceIds = [...new Set(form.getAll("evidence_id").map(String))];
  const allowed = new Set(weakness?.evidence.map((item) => item.id) ?? []);
  if (!weakness || !VULNERABILITY_LEVELS.includes(impact) || !VULNERABILITY_LEVELS.includes(probability) ||
      !VULNERABILITY_LEVELS.includes(actionCapacity) || rationale.length < 10 || rationale.length > 1500 ||
      evidenceIds.length === 0 || evidenceIds.some((id) => !allowed.has(id)))
    redirect(`${path}?matrix=${matrix.id}&error=vulnerability`);
  const prior = (await getVulnerabilities(matrix.id)).find((item) => item.weakness_factor_id === weaknessId);
  if (prior?.impact === impact && prior.probability === probability && prior.action_capacity === actionCapacity &&
      prior.rationale === rationale && prior.evidence_ids_json === JSON.stringify(evidenceIds))
    redirect(`${path}?matrix=${matrix.id}&saved=1#vulnerabilidad`);
  const reserved = await db.prepare("UPDATE foda_matrix_versions SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(matrix.id, matrix.revision).run();
  if (reserved.meta.changes !== 1) redirect(`${path}?matrix=${matrix.id}&error=stale`);
  const id = prior?.id ?? crypto.randomUUID();
  await db.batch([
    prior ? db.prepare("UPDATE foda_vulnerabilities SET impact = ?, probability = ?, action_capacity = ?, rationale = ?, evidence_ids_json = ?, updated_by_user_id = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND matrix_id = ?")
      .bind(impact, probability, actionCapacity, rationale, JSON.stringify(evidenceIds), actor.user.userId, id, matrix.id)
      : db.prepare("INSERT INTO foda_vulnerabilities (id, matrix_id, weakness_factor_id, impact, probability, action_capacity, rationale, evidence_ids_json, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, matrix.id, weaknessId, impact, probability, actionCapacity, rationale, JSON.stringify(evidenceIds), actor.user.userId),
    audit(db, actor, cycle.id, "foda.vulnerability_saved", "foda_vulnerability", id,
      { matrixId: matrix.id, weaknessId, impact, probability, actionCapacity, rationale, evidenceIds,
        prior, matrixRevision: matrix.revision + 1 }),
  ]);
  refresh(); redirect(`${path}?matrix=${matrix.id}&saved=1#vulnerabilidad`);
}

export async function voteFodaMatrix(form: FormData) {
  const { actor, cycle, set, db } = await context();
  await leader(actor);
  const { matrix, source } = await editableMatrix(set, field(form, "matrix_id"), Number(field(form, "expected_revision")));
  const scores = await getMatrixScores(matrix.id);
  if (!quadrantResults(source, "FO", scores).complete || !quadrantResults(source, "DA", scores).complete)
    redirect(`${path}?matrix=${matrix.id}&error=incomplete`);
  if (!(await supplementaryComplete(matrix.id, source, scores))) redirect(`${path}?matrix=${matrix.id}&error=incomplete`);
  if (await getMatrixReview(cycle.id, matrix)) redirect(`${path}?matrix=${matrix.id}&error=review_locked`);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["validated", "doubt", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500)
    redirect(`${path}?matrix=${matrix.id}&error=vote`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO foda_matrix_votes (id, matrix_id, matrix_revision, member_id, decision, rationale) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, matrix.id, matrix.revision, actor.memberId, decision, rationale),
    audit(db, actor, cycle.id, "foda.matrix_voted", "foda_matrix", matrix.id,
      { matrixVersion: matrix.matrix_version, revision: matrix.revision, decision, rationale, voteId: id }),
  ]);
  refresh(); redirect(`${path}?matrix=${matrix.id}&voted=1`);
}

export async function reviewFodaMatrix(form: FormData) {
  const { actor, cycle, set, db } = await context();
  if (actor.role !== "consultant") redirect(`${path}?error=permission`);
  const { matrix, source } = await editableMatrix(set, field(form, "matrix_id"), Number(field(form, "expected_revision")));
  const scores = await getMatrixScores(matrix.id);
  if (!quadrantResults(source, "FO", scores).complete || !quadrantResults(source, "DA", scores).complete)
    redirect(`${path}?matrix=${matrix.id}&error=incomplete`);
  if (!(await supplementaryComplete(matrix.id, source, scores))) redirect(`${path}?matrix=${matrix.id}&error=incomplete`);
  const votes = await getMatrixVotes(matrix);
  const voteState = matrixVoteState(votes, await getMembers(actor.organizationId!));
  if (!voteState.ready || await getMatrixReview(cycle.id, matrix)) redirect(`${path}?matrix=${matrix.id}&error=quorum`);
  const decision = field(form, "decision"), rationale = field(form, "rationale");
  if (!["approved", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500)
    redirect(`${path}?matrix=${matrix.id}&error=review`);
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, 'foda.matrix', ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, matrixReviewSubject(matrix), decision, actor.user.userId, rationale,
        JSON.stringify(voteState.current.map((vote) => vote.id)), METHODOLOGY_VERSION),
    audit(db, actor, cycle.id, "foda.matrix_reviewed", "foda_matrix", matrix.id,
      { matrixVersion: matrix.matrix_version, revision: matrix.revision, decision, rationale,
        voteIds: voteState.current.map((vote) => vote.id), reviewId: id }),
  ]);
  refresh(); redirect(`${path}?matrix=${matrix.id}&reviewed=1`);
}

export async function approveFodaMatrix(form: FormData) {
  const { actor, cycle, set, db } = await context();
  const member = await leader(actor);
  if (!member.is_director) redirect(`${path}?error=permission`);
  const { matrix, source } = await editableMatrix(set, field(form, "matrix_id"), Number(field(form, "expected_revision")));
  const scores = await getMatrixScores(matrix.id);
  const fo = quadrantResults(source, "FO", scores), da = quadrantResults(source, "DA", scores);
  if (!fo.complete || !da.complete) redirect(`${path}?matrix=${matrix.id}&error=incomplete`);
  if (!(await supplementaryComplete(matrix.id, source, scores))) redirect(`${path}?matrix=${matrix.id}&error=incomplete`);
  const votes = matrixVoteState(await getMatrixVotes(matrix), await getMembers(actor.organizationId!));
  const review = await getMatrixReview(cycle.id, matrix);
  if (!votes.ready || review?.status !== "approved" ||
      JSON.stringify([...votes.current.map((vote) => vote.id)].sort()) !==
      JSON.stringify([...(JSON.parse(review.source_ids_json) as string[])].sort()))
    redirect(`${path}?matrix=${matrix.id}&error=review`);
  const result = await db.prepare("UPDATE foda_matrix_versions SET status = 'approved', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND revision = ?")
    .bind(actor.user.userId, matrix.id, matrix.revision).run();
  if (result.meta.changes !== 1) redirect(`${path}?matrix=${matrix.id}&error=stale`);
  await audit(db, actor, cycle.id, "foda.matrix_approved", "foda_matrix", matrix.id,
    { matrixVersion: matrix.matrix_version, setVersion: matrix.set_version, sourceSnapshotId: matrix.source_snapshot_id,
      revision: matrix.revision, reviewId: review.id, voteIds: votes.current.map((vote) => vote.id),
      FO: fo.internal.concat(fo.external).map((item) => ({ factorId: item.factor.id, total: item.total, average: item.average, priority: item.priority })),
      DA: da.internal.concat(da.external).map((item) => ({ factorId: item.factor.id, total: item.total, average: item.average, priority: item.priority })) }).run();
  const approved = await getMatrixVersion(matrix.id, set.id);
  if (approved) await updateProgress(cycle.id, approved, actor.user.userId);
  refresh(); redirect(`${path}?matrix=${matrix.id}&approved=1`);
}

export async function reopenFodaMatrix(form: FormData) {
  const { actor, cycle, set, db } = await context();
  const member = await leader(actor);
  if (!member.is_director) redirect(`${path}?error=permission`);
  const previous = await getMatrixVersion(field(form, "matrix_id"), set.id);
  const reason = field(form, "reason");
  if (!previous || previous.status !== "approved" || set.status !== "frozen" || previous.set_version !== set.version ||
      reason.length < 10 || reason.length > 1500) redirect(`${path}?error=reopen`);
  const versions = await getMatrixVersions(set.id);
  if (versions.some((item) => item.set_version === set.version && item.matrix_version > previous.matrix_version))
    redirect(`${path}?error=stale`);
  const nextId = crypto.randomUUID(), nextVersion = previous.matrix_version + 1;
  const scores = await getMatrixScores(previous.id);
  const notes = await getQualitativeNotes(previous.id);
  const vulnerabilities = await getVulnerabilities(previous.id);
  await db.batch([
    db.prepare("INSERT INTO foda_matrix_versions (id, set_id, set_version, matrix_version, source_snapshot_id, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(nextId, set.id, set.version, nextVersion, previous.source_snapshot_id, actor.user.userId),
    ...scores.map((score) => db.prepare("INSERT INTO foda_cross_scores (id, matrix_id, quadrant, internal_factor_id, external_factor_id, final_score, final_rationale, final_evidence_ids_json, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), nextId, score.quadrant, score.internal_factor_id, score.external_factor_id,
        score.final_score, score.final_rationale, score.final_evidence_ids_json, actor.user.userId)),
    ...notes.map((note) => db.prepare("INSERT INTO foda_qualitative_notes (id, matrix_id, quadrant, narrative, factor_ids_json, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), nextId, note.quadrant, note.narrative, note.factor_ids_json, actor.user.userId)),
    ...vulnerabilities.map((item) => db.prepare("INSERT INTO foda_vulnerabilities (id, matrix_id, weakness_factor_id, impact, probability, action_capacity, rationale, evidence_ids_json, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), nextId, item.weakness_factor_id, item.impact, item.probability,
        item.action_capacity, item.rationale, item.evidence_ids_json, actor.user.userId)),
    audit(db, actor, cycle.id, "foda.matrix_reopened", "foda_matrix", nextId,
      { previousMatrixId: previous.id, previousVersion: previous.matrix_version, newVersion: nextVersion,
        setVersion: set.version, reason, copiedScores: scores.length }),
  ]);
  const next = await getMatrixVersion(nextId, set.id);
  if (next) await updateProgress(cycle.id, next, actor.user.userId);
  refresh(); redirect(`${path}?matrix=${nextId}&reopened=1`);
}
