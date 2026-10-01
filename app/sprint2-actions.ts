"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getD1 } from "@/db";
import { getActor } from "@/lib/authz";
import { getCurrentCycle } from "@/lib/workspace";
import {
  diagnosticSubject, getDiagnosticInputs, getPhilosophyAnswers, getPhilosophyStatements,
  getProjectProfile, getValueBehaviors, isHighLevelMember, latestApproval,
  philosophyQuestions, statementSubject, valuesSubject,
} from "@/lib/sprint2";
import { METHODOLOGY_VERSION } from "@/lib/methodology";

const clean = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const allowedAreas = ["operativa", "comercial", "financiera"];
const allowedClasses = ["dato", "supuesto", "falta"];
const allowedSources = ["documento", "entrevista", "reporte_empresa", "otra", "sin_fuente"];

async function context(returnTo: string) {
  const actor = await getActor();
  if (!actor?.organizationId) redirect(`${returnTo}?error=permission`);
  const cycle = await getCurrentCycle(actor.organizationId);
  if (!cycle) redirect(`${returnTo}?error=cycle`);
  return { actor, cycle, db: getD1() };
}

function auditStatement(db: D1Database, organizationId: string, cycleId: string, actor: NonNullable<Awaited<ReturnType<typeof getActor>>>, eventType: string, subjectType: string, subjectId: string, payload: unknown) {
  return db.prepare("INSERT INTO audit_events (id, organization_id, cycle_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), organizationId, cycleId, actor.user.userId, actor.user.email.toLowerCase(), eventType, subjectType, subjectId, JSON.stringify(payload));
}

async function updateProfileProgress(cycleId: string, actorUserId: string) {
  const [profile, answers, statements, values] = await Promise.all([
    getProjectProfile(cycleId), getPhilosophyAnswers(cycleId), getPhilosophyStatements(cycleId), getValueBehaviors(cycleId),
  ]);
  let approvedStatements = 0;
  for (const item of statements) {
    if ((await latestApproval(cycleId, `philosophy.${item.kind}`, statementSubject(item)))?.status === "approved") approvedStatements++;
  }
  const valuesApproved = values.length > 0 && statements.length === 2 && (await latestApproval(cycleId, "philosophy.values", valuesSubject(values, statements)))?.status === "approved";
  const profileComplete = Boolean(profile?.scope && profile.calendar_notes && profile.primary_sources && profile.secondary_sources);
  const answered = philosophyQuestions.filter((question) => answers.some((item) => item.question_key === question.key && item.answer)).length;
  const done = answered + approvedStatements + Number(valuesApproved) + Number(profileComplete);
  const percent = Math.round(done * 100 / 14);
  const status = done === 14 ? "approved" : "in_progress";
  const summary = `${answered}/10 respuestas · ${approvedStatements}/2 enunciados aprobados · valores ${valuesApproved ? "aprobados" : "pendientes"}`;
  await getD1().prepare("INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary, updated_by_user_id) VALUES (?, ?, 'organizacion', ?, ?, ?, ?) ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = excluded.status, percent = excluded.percent, summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(crypto.randomUUID(), cycleId, status, percent, summary, actorUserId).run();
}

async function updateDiagnosticProgress(cycleId: string, actorUserId: string) {
  const items = await getDiagnosticInputs(cycleId);
  const areas = allowedAreas.filter((area) => items.some((item) => item.area === area));
  const approved = areas.length === 3 && (await latestApproval(cycleId, "diagnostic.review", diagnosticSubject(items)))?.status === "approved";
  const percent = Math.round((areas.length + Number(approved)) * 25);
  const summary = `${areas.length}/3 ámbitos registrados · ${approved ? "revisado por consultor" : "revisión pendiente"}`;
  await getD1().prepare("INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary, updated_by_user_id) VALUES (?, ?, 'diagnostico', ?, ?, ?, ?) ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = excluded.status, percent = excluded.percent, summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(crypto.randomUUID(), cycleId, approved ? "approved" : "in_progress", percent, summary, actorUserId).run();
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/organizacion");
  revalidatePath("/organizacion/filosofia");
  revalidatePath("/diagnostico");
}

export async function saveProjectProfile(form: FormData) {
  const { actor, cycle, db } = await context("/organizacion");
  if (!["owner", "consultant"].includes(actor.role)) redirect("/organizacion?error=permission");
  const scope = clean(form, "scope"), calendar = clean(form, "calendar_notes");
  const primary = clean(form, "primary_sources"), secondary = clean(form, "secondary_sources");
  if ([scope, calendar, primary, secondary].some((text) => text.length > 3000)) redirect("/organizacion?error=invalid");
  const previous = await getProjectProfile(cycle.id);
  const id = previous?.id ?? crypto.randomUUID();
  const writes = [db.prepare("INSERT INTO project_profiles (id, cycle_id, scope, calendar_notes, primary_sources, secondary_sources, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(cycle_id) DO UPDATE SET scope = excluded.scope, calendar_notes = excluded.calendar_notes, primary_sources = excluded.primary_sources, secondary_sources = excluded.secondary_sources, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(id, cycle.id, scope, calendar, primary, secondary, actor.user.userId)];
  if (previous && (previous.scope !== scope || previous.calendar_notes !== calendar || previous.primary_sources !== primary || previous.secondary_sources !== secondary)) {
    writes.push(db.prepare("UPDATE philosophy_statements SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE cycle_id = ?")
      .bind(cycle.id));
  }
  writes.push(auditStatement(db, actor.organizationId!, cycle.id, actor, "profile.saved", "project_profile", id, { previous, current: { scope, calendar, primary, secondary } }));
  await db.batch(writes);
  await updateProfileProgress(cycle.id, actor.user.userId); refresh(); redirect("/organizacion?saved=1");
}

export async function savePhilosophyAnswer(form: FormData) {
  const { actor, cycle, db } = await context("/organizacion/filosofia");
  if (!(await isHighLevelMember(actor.organizationId!, actor.memberId))) redirect("/organizacion/filosofia?error=permission");
  const key = clean(form, "question_key");
  const questionIndex = philosophyQuestions.findIndex((item) => item.key === key);
  const answer = clean(form, "answer");
  if (questionIndex < 0 || answer.length < 3 || answer.length > 2000) redirect(`/organizacion/filosofia?q=${encodeURIComponent(key)}&error=invalid`);
  const prior = await db.prepare("SELECT id, answer, version FROM philosophy_answers WHERE cycle_id = ? AND question_key = ?").bind(cycle.id, key).first<{ id: string; answer: string; version: number }>();
  const id = prior?.id ?? crypto.randomUUID();
  const writes = [db.prepare("INSERT INTO philosophy_answers (id, cycle_id, question_key, answer, updated_by_user_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(cycle_id, question_key) DO UPDATE SET answer = excluded.answer, version = philosophy_answers.version + 1, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(id, cycle.id, key, answer, actor.user.userId)];
  // A changed workshop answer invalidates approval of a statement drafted from it.
  if (prior?.answer !== answer) writes.push(db.prepare("UPDATE philosophy_statements SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE cycle_id = ? AND kind = ?")
    .bind(cycle.id, philosophyQuestions[questionIndex].group));
  writes.push(auditStatement(db, actor.organizationId!, cycle.id, actor, "philosophy.answer_saved", "philosophy_answer", id, { key, previous: prior, answer }));
  await db.batch(writes);
  await updateProfileProgress(cycle.id, actor.user.userId); refresh();
  redirect(`/organizacion/filosofia?q=${philosophyQuestions[Math.min(questionIndex + 1, philosophyQuestions.length - 1)].key}&saved=1`);
}

export async function savePhilosophyStatement(form: FormData) {
  const { actor, cycle, db } = await context("/organizacion/filosofia");
  if (!(await isHighLevelMember(actor.organizationId!, actor.memberId))) redirect("/organizacion/filosofia?error=permission");
  const kind = clean(form, "kind");
  const statement = clean(form, "statement");
  if (!["mission", "vision"].includes(kind) || statement.length < 20 || statement.length > 3000) redirect("/organizacion/filosofia?error=invalid");
  const answers = await getPhilosophyAnswers(cycle.id);
  if (philosophyQuestions.some((item) => item.group === kind && !answers.some((answer) => answer.question_key === item.key && answer.answer))) redirect("/organizacion/filosofia?error=incomplete");
  const prior = await db.prepare("SELECT id, statement, version FROM philosophy_statements WHERE cycle_id = ? AND kind = ?").bind(cycle.id, kind).first<{ id: string; statement: string; version: number }>();
  const id = prior?.id ?? crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO philosophy_statements (id, cycle_id, kind, statement, updated_by_user_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(cycle_id, kind) DO UPDATE SET statement = excluded.statement, version = philosophy_statements.version + 1, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
      .bind(id, cycle.id, kind, statement, actor.user.userId),
    auditStatement(db, actor.organizationId!, cycle.id, actor, "philosophy.statement_saved", "philosophy_statement", id, { kind, previous: prior, statement, origin: "client_draft" }),
  ]);
  await updateProfileProgress(cycle.id, actor.user.userId); refresh(); redirect("/organizacion/filosofia?saved=1#enunciados");
}

export async function reviewPhilosophyStatement(form: FormData) {
  const { actor, cycle, db } = await context("/organizacion/filosofia");
  if (actor.role !== "consultant") redirect("/organizacion/filosofia?error=permission");
  const kind = clean(form, "kind"), rationale = clean(form, "rationale"), decision = clean(form, "decision");
  if (!["mission", "vision"].includes(kind) || !["approved", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500) redirect("/organizacion/filosofia?error=invalid");
  const statement = (await getPhilosophyStatements(cycle.id)).find((item) => item.kind === kind);
  if (!statement) redirect("/organizacion/filosofia?error=incomplete");
  const answers = (await getPhilosophyAnswers(cycle.id)).filter((item) => philosophyQuestions.some((question) => question.group === kind && question.key === item.question_key));
  if (answers.length !== philosophyQuestions.filter((item) => item.group === kind).length) redirect("/organizacion/filosofia?error=incomplete");
  const subject = statementSubject(statement);
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), cycle.id, `philosophy.${kind}`, subject, decision, actor.user.userId, rationale, JSON.stringify(answers.map((item) => `${item.id}:v${item.version}`)), METHODOLOGY_VERSION),
    auditStatement(db, actor.organizationId!, cycle.id, actor, "philosophy.statement_reviewed", "philosophy_statement", statement.id, { kind, subject, decision, rationale }),
  ]);
  await updateProfileProgress(cycle.id, actor.user.userId); refresh(); redirect("/organizacion/filosofia?reviewed=1#enunciados");
}

export async function saveValueBehavior(form: FormData) {
  const { actor, cycle, db } = await context("/organizacion/filosofia");
  if (!(await isHighLevelMember(actor.organizationId!, actor.memberId))) redirect("/organizacion/filosofia?error=permission");
  const statements = await getPhilosophyStatements(cycle.id);
  if (statements.length !== 2 || !(await Promise.all(statements.map((item) => latestApproval(cycle.id, `philosophy.${item.kind}`, statementSubject(item))))).every((item) => item?.status === "approved")) redirect("/organizacion/filosofia?error=statements");
  const id = clean(form, "id") || crypto.randomUUID();
  const name = clean(form, "value_name"), behavior = clean(form, "behavior"), mission = clean(form, "mission_link"), vision = clean(form, "vision_link");
  if (name.length < 2 || name.length > 120 || behavior.length < 10 || behavior.length > 1500 || (!mission && !vision) || mission.length > 500 || vision.length > 500) redirect("/organizacion/filosofia?error=invalid");
  const prior = await db.prepare("SELECT * FROM value_behaviors WHERE id = ? AND cycle_id = ?").bind(id, cycle.id).first();
  if (clean(form, "id") && !prior) redirect("/organizacion/filosofia?error=missing");
  const change = prior
    ? db.prepare("UPDATE value_behaviors SET value_name = ?, behavior = ?, mission_link = ?, vision_link = ?, version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND cycle_id = ?")
      .bind(name, behavior, mission || null, vision || null, actor.user.userId, id, cycle.id)
    : db.prepare("INSERT INTO value_behaviors (id, cycle_id, value_name, behavior, mission_link, vision_link, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, name, behavior, mission || null, vision || null, actor.user.userId);
  await db.batch([change, auditStatement(db, actor.organizationId!, cycle.id, actor, "philosophy.value_saved", "value_behavior", id, { previous: prior, current: { name, behavior, mission, vision } })]);
  await updateProfileProgress(cycle.id, actor.user.userId); refresh(); redirect("/organizacion/filosofia?saved=1#valores");
}

export async function reviewValues(form: FormData) {
  const { actor, cycle, db } = await context("/organizacion/filosofia");
  if (actor.role !== "consultant") redirect("/organizacion/filosofia?error=permission");
  const items = await getValueBehaviors(cycle.id);
  const statements = await getPhilosophyStatements(cycle.id);
  if (statements.length !== 2 || !(await Promise.all(statements.map((item) => latestApproval(cycle.id, `philosophy.${item.kind}`, statementSubject(item))))).every((item) => item?.status === "approved")) redirect("/organizacion/filosofia?error=statements");
  const rationale = clean(form, "rationale"), decision = clean(form, "decision");
  if (!items.length || items.some((item) => !item.mission_link && !item.vision_link) || !["approved", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500) redirect("/organizacion/filosofia?error=invalid");
  const subject = valuesSubject(items, statements);
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, 'philosophy.values', ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), cycle.id, subject, decision, actor.user.userId, rationale, JSON.stringify(items.map((item) => `${item.id}:v${item.version}`)), METHODOLOGY_VERSION),
    auditStatement(db, actor.organizationId!, cycle.id, actor, "philosophy.values_reviewed", "value_behaviors", subject, { decision, rationale }),
  ]);
  await updateProfileProgress(cycle.id, actor.user.userId); refresh(); redirect("/organizacion/filosofia?reviewed=1#valores");
}

export async function saveDiagnosticInput(form: FormData) {
  const { actor, cycle, db } = await context("/diagnostico");
  if (!(await isHighLevelMember(actor.organizationId!, actor.memberId))) redirect("/diagnostico?error=permission");
  const id = clean(form, "id") || crypto.randomUUID();
  const area = clean(form, "area"), classification = clean(form, "classification"), statement = clean(form, "statement");
  const sourceType = clean(form, "source_type"), sourceDetail = clean(form, "source_detail"), period = clean(form, "period");
  if (!allowedAreas.includes(area) || !allowedClasses.includes(classification) || !allowedSources.includes(sourceType) || statement.length < 5 || statement.length > 3000 || sourceDetail.length > 1000 || period.length > 120 || (classification === "dato" && (!sourceDetail || sourceType === "sin_fuente"))) redirect("/diagnostico?error=invalid");
  const prior = await db.prepare("SELECT * FROM diagnostic_inputs WHERE id = ? AND cycle_id = ?").bind(id, cycle.id).first();
  if (clean(form, "id") && !prior) redirect("/diagnostico?error=missing");
  const change = prior
    ? db.prepare("UPDATE diagnostic_inputs SET area = ?, classification = ?, statement = ?, source_type = ?, source_detail = ?, period = ?, version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND cycle_id = ?")
      .bind(area, classification, statement, sourceType, sourceDetail, period, actor.user.userId, id, cycle.id)
    : db.prepare("INSERT INTO diagnostic_inputs (id, cycle_id, area, classification, statement, source_type, source_detail, period, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, cycle.id, area, classification, statement, sourceType, sourceDetail, period, actor.user.userId, actor.user.userId);
  await db.batch([change, auditStatement(db, actor.organizationId!, cycle.id, actor, "diagnostic.input_saved", "diagnostic_input", id, { previous: prior, current: { area, classification, statement, sourceType, sourceDetail, period } })]);
  await updateDiagnosticProgress(cycle.id, actor.user.userId); refresh(); redirect("/diagnostico?saved=1");
}

export async function reviewDiagnostic(form: FormData) {
  const { actor, cycle, db } = await context("/diagnostico");
  if (actor.role !== "consultant") redirect("/diagnostico?error=permission");
  const items = await getDiagnosticInputs(cycle.id);
  const rationale = clean(form, "rationale"), decision = clean(form, "decision");
  if (allowedAreas.some((area) => !items.some((item) => item.area === area)) || !["approved", "changes_requested"].includes(decision) || rationale.length < 10 || rationale.length > 1500) redirect("/diagnostico?error=incomplete");
  const subject = diagnosticSubject(items);
  await db.batch([
    db.prepare("INSERT INTO approvals (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version) VALUES (?, ?, 'diagnostic.review', ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), cycle.id, subject, decision, actor.user.userId, rationale, JSON.stringify(items.map((item) => `${item.id}:v${item.version}`)), METHODOLOGY_VERSION),
    auditStatement(db, actor.organizationId!, cycle.id, actor, "diagnostic.reviewed", "diagnostic", subject, { decision, rationale }),
  ]);
  await updateDiagnosticProgress(cycle.id, actor.user.userId); refresh(); redirect("/diagnostico?reviewed=1");
}
