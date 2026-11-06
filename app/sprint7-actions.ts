"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getD1 } from "@/db";
import { getActor } from "@/lib/authz";
import { getApprovedStrategy, getInitiatives, getObjectives } from "@/lib/sprint6";
import { areaIssues, budgetIssues, kpiIssues, kpiReadiness, parseMilestones, planIssues, validDate } from "@/lib/sprint7-policy.mts";
import { getCurrentCycle } from "@/lib/workspace";
import { getAreaScorecards, getExecutionPlans, type BudgetEntry,
  type ExecutionPlan, type KpiSpec } from "@/lib/sprint7";

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const planPath = "/modulos/ejecucion";
const kpiPath = "/modulos/kpis";
function fail(path: string, code: string): never { redirect(`${path}?error=${code}`); }

async function context(path: string) {
  const actor = await getActor();
  if (!actor?.organizationId || !actor.memberId) fail(path, "permission");
  const db = getD1();
  const member = await db.prepare("SELECT status, role, is_leader FROM members WHERE id = ? AND organization_id = ?")
    .bind(actor.memberId, actor.organizationId).first<{ status: string; role: string; is_leader: number }>();
  if (!member || member.status !== "active" || !member.is_leader ||
    !["owner", "admin", "leader"].includes(member.role)) fail(path, "permission");
  const cycle = await getCurrentCycle(actor.organizationId);
  if (!cycle) fail(path, "source");
  const strategy = await getApprovedStrategy(cycle.id);
  if (!strategy) fail(path, "source");
  const [objectivesProgress, initiativesProgress] = await Promise.all([
    db.prepare("SELECT status FROM module_progress WHERE cycle_id = ? AND module_slug = 'objetivos'")
      .bind(cycle.id).first<{ status: string }>(),
    db.prepare("SELECT status FROM module_progress WHERE cycle_id = ? AND module_slug = 'iniciativas'")
      .bind(cycle.id).first<{ status: string }>(),
  ]);
  if (objectivesProgress?.status !== "approved" || initiativesProgress?.status !== "approved") fail(path, "source");
  const reviewProgress = await db.prepare("SELECT status, percent FROM module_progress WHERE cycle_id = ? AND module_slug IN ('ejecucion', 'kpis')")
    .bind(cycle.id).all<{ status: string; percent: number }>();
  if ((reviewProgress.results ?? []).some((item) => item.status === "approved" || item.percent >= 90))
    fail(path, "review_locked");
  return { actor, db, cycle, strategy };
}

function audit(ctx: Awaited<ReturnType<typeof context>>, event: string, subjectType: string, subjectId: string,
  payload: unknown) {
  return ctx.db.prepare("INSERT INTO audit_events (id, organization_id, cycle_id, actor_user_id, actor_email, event_type, subject_type, subject_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), ctx.actor.organizationId, ctx.cycle.id, ctx.actor.user.userId,
      ctx.actor.user.email.toLowerCase(), event, subjectType, subjectId, JSON.stringify(payload));
}

async function updateProgress(ctx: Awaited<ReturnType<typeof context>>, slug: string, summary: string) {
  await ctx.db.prepare("INSERT INTO module_progress (id, cycle_id, module_slug, status, percent, summary, updated_by_user_id) VALUES (?, ?, ?, 'in_progress', 20, ?, ?) ON CONFLICT(cycle_id, module_slug) DO UPDATE SET status = 'in_progress', percent = 20, summary = excluded.summary, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(crypto.randomUUID(), ctx.cycle.id, slug, summary, ctx.actor.user.userId).run();
}

async function activeResponsible(ctx: Awaited<ReturnType<typeof context>>, id: string) {
  return !id || Boolean(await ctx.db.prepare("SELECT id FROM members WHERE id = ? AND organization_id = ? AND status = 'active'")
    .bind(id, ctx.actor.organizationId).first());
}

export async function saveExecutionPlan(form: FormData) {
  const ctx = await context(planPath);
  const initiativeId = field(form, "initiative_id");
  const initiative = (await getInitiatives(ctx.cycle.id)).find((item) => item.id === initiativeId && item.status === "approved");
  const objective = initiative && (await getObjectives(ctx.strategy.id)).find((item) =>
    item.id === initiative.objective_id && item.status === "approved" && item.version === initiative.objective_version);
  if (!initiative || !objective) fail(planPath, "source");
  const responsibleId = field(form, "responsible_member_id");
  if (!await activeResponsible(ctx, responsibleId)) fail(planPath, "responsible");
  const startDate = field(form, "start_date"), endDate = field(form, "end_date");
  const parsed = parseMilestones(field(form, "milestones"));
  const resources = field(form, "resources"), risks = field(form, "risks");
  const issues = planIssues({ startDate, endDate, milestones: parsed.milestones, resources, risks,
    responsibleMemberId: responsibleId });
  if (parsed.error || startDate && !validDate(startDate) || endDate && !validDate(endDate) ||
    issues.includes("orden de fechas") || issues.includes("fechas de hitos") || resources.length > 3000 || risks.length > 3000)
    fail(planPath, "invalid");
  const id = field(form, "id"), version = Number(field(form, "version"));
  const existing = await ctx.db.prepare("SELECT * FROM execution_plans WHERE initiative_id = ? AND cycle_id = ?")
    .bind(initiative.id, ctx.cycle.id).first<ExecutionPlan>();
  if (id && (!existing || id !== existing.id || version !== existing.version || existing.status !== "draft")) fail(planPath, "stale");
  if (!id && existing) fail(planPath, "stale");
  const planId = existing?.id ?? crypto.randomUUID();
  const values = [responsibleId || null, startDate || null, endDate || null,
    JSON.stringify(parsed.milestones), resources, risks];
  if (existing) {
    const result = await ctx.db.prepare("UPDATE execution_plans SET responsible_member_id = ?, start_date = ?, end_date = ?, milestones_json = ?, resources = ?, risks = ?, version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND cycle_id = ? AND version = ? AND status = 'draft' AND initiative_version = ? AND objective_version = ?")
      .bind(...values, ctx.actor.user.userId, planId, ctx.cycle.id, version, initiative.version, objective.version).run();
    if (result.meta.changes !== 1) fail(planPath, "stale");
  } else {
    await ctx.db.prepare("INSERT INTO execution_plans (id, cycle_id, initiative_id, initiative_version, objective_id, objective_version, responsible_member_id, start_date, end_date, milestones_json, resources, risks, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(planId, ctx.cycle.id, initiative.id, initiative.version, objective.id, objective.version,
        ...values, ctx.actor.user.userId).run();
  }
  await audit(ctx, existing ? "sprint7.plan.updated" : "sprint7.plan.created", "execution_plan", planId,
    { source: { initiativeId, initiativeVersion: initiative.version, objectiveId: objective.id,
      objectiveVersion: objective.version }, version: existing ? version + 1 : 1,
      readiness: issues.length ? "pendiente" : "lista_para_revision", fields: values, previous: existing ?? null }).run();
  await updateProgress(ctx, "ejecucion", "Planes de ejecución en borrador; faltan revisión, presupuesto y CMI.");
  revalidatePath("/"); revalidatePath(planPath);
  redirect(`${planPath}?saved=1#plan-${planId}`);
}

export async function saveKpiSpec(form: FormData) {
  const ctx = await context(kpiPath);
  const objectiveId = field(form, "objective_id");
  const objective = (await getObjectives(ctx.strategy.id)).find((item) => item.id === objectiveId && item.status === "approved");
  if (!objective) fail(kpiPath, "source");
  const responsibleId = field(form, "responsible_member_id");
  if (!await activeResponsible(ctx, responsibleId)) fail(kpiPath, "responsible");
  const input = {
    formula: field(form, "formula"), denominator: field(form, "denominator"),
    requiresDenominator: field(form, "requires_denominator") === "yes" || /[/÷]/.test(field(form, "formula")),
    source: field(form, "source"), baseline: field(form, "baseline"),
    target: field(form, "target"), frequency: field(form, "frequency"),
    responsibleMemberId: responsibleId, direction: field(form, "direction"),
    tolerance: field(form, "tolerance"), toleranceRationale: field(form, "tolerance_rationale"),
  };
  const issues = kpiIssues(input);
  if (input.formula.length > 1000 || input.denominator.length > 500 || input.source.length > 1000 ||
    input.toleranceRationale.length > 1500 || input.frequency.length > 120 ||
    input.direction && !["higher", "lower", "range"].includes(input.direction) ||
    input.baseline && issues.includes("línea base") ||
    input.target && issues.some((item) => item === "meta" || item === "meta en rango") ||
    input.tolerance && issues.some((item) => item === "tolerancia" || item === "tolerancia en rango")) fail(kpiPath, "invalid");
  const id = field(form, "id"), version = Number(field(form, "version"));
  const existing = await ctx.db.prepare("SELECT * FROM kpi_specs WHERE objective_id = ? AND cycle_id = ?")
    .bind(objective.id, ctx.cycle.id).first<KpiSpec>();
  if (id && (!existing || id !== existing.id || version !== existing.version || existing.status !== "draft")) fail(kpiPath, "stale");
  if (!id && existing) fail(kpiPath, "stale");
  const specId = existing?.id ?? crypto.randomUUID();
  const values = [input.formula, input.denominator, input.requiresDenominator ? 1 : 0,
    input.source, input.baseline, input.target, input.frequency, responsibleId || null,
    input.direction, input.tolerance, input.toleranceRationale];
  if (existing) {
    const result = await ctx.db.prepare("UPDATE kpi_specs SET formula = ?, denominator = ?, requires_denominator = ?, source = ?, baseline = ?, target = ?, frequency = ?, responsible_member_id = ?, direction = ?, tolerance = ?, tolerance_rationale = ?, version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND cycle_id = ? AND version = ? AND status = 'draft' AND objective_version = ?")
      .bind(...values, ctx.actor.user.userId, specId, ctx.cycle.id, version, objective.version).run();
    if (result.meta.changes !== 1) fail(kpiPath, "stale");
  } else {
    await ctx.db.prepare("INSERT INTO kpi_specs (id, cycle_id, objective_id, objective_version, formula, denominator, requires_denominator, source, baseline, target, frequency, responsible_member_id, direction, tolerance, tolerance_rationale, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(specId, ctx.cycle.id, objective.id, objective.version, ...values, ctx.actor.user.userId).run();
  }
  await audit(ctx, existing ? "sprint7.kpi.updated" : "sprint7.kpi.created", "kpi_spec", specId,
    { source: { objectiveId, objectiveVersion: objective.version, name: objective.kpi_name,
      unit: objective.kpi_unit }, version: existing ? version + 1 : 1,
      readiness: kpiReadiness(input), fields: values, previous: existing ?? null }).run();
  await updateProgress(ctx, "kpis", "Fichas KPI en borrador; tolerancias y metas requieren aprobación humana.");
  revalidatePath("/"); revalidatePath(kpiPath);
  redirect(`${kpiPath}?saved=1#kpi-${specId}`);
}

export async function saveBudgetEntry(form: FormData) {
  const ctx = await context(planPath);
  const planId = field(form, "plan_id"), periodKey = field(form, "period_key");
  const plan = (await getExecutionPlans(ctx.cycle.id)).find((item) => item.id === planId && item.status === "draft");
  const initiative = plan && (await getInitiatives(ctx.cycle.id)).find((item) => item.id === plan.initiative_id &&
    item.status === "approved" && item.version === plan.initiative_version);
  const objective = plan && (await getObjectives(ctx.strategy.id)).find((item) => item.id === plan.objective_id &&
    item.status === "approved" && item.version === plan.objective_version);
  if (!plan || !initiative || !objective) fail(planPath, "source");
  const amount = field(form, "amount"), currency = field(form, "currency").toUpperCase();
  const sourceNote = field(form, "source_note");
  const issues = budgetIssues({ periodKey, amount, currency, sourceNote });
  if (issues.includes("periodo") || amount && issues.includes("importe") ||
    currency && issues.includes("moneda") || sourceNote.length > 1000) fail(planPath, "budget");
  const id = field(form, "id"), version = Number(field(form, "version"));
  const existing = await ctx.db.prepare("SELECT * FROM budget_entries WHERE plan_id = ? AND period_key = ? AND cycle_id = ?")
    .bind(planId, periodKey, ctx.cycle.id).first<BudgetEntry>();
  if (id && (!existing || existing.id !== id || existing.version !== version || existing.status !== "draft")) fail(planPath, "stale");
  if (!id && existing) fail(planPath, "stale");
  const budgetId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    const result = await ctx.db.prepare("UPDATE budget_entries SET amount = ?, currency = ?, source_note = ?, version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ? AND status = 'draft'")
      .bind(amount, currency, sourceNote, ctx.actor.user.userId, budgetId, version).run();
    if (result.meta.changes !== 1) fail(planPath, "stale");
  } else {
    await ctx.db.prepare("INSERT INTO budget_entries (id, cycle_id, plan_id, period_key, amount, currency, source_note, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(budgetId, ctx.cycle.id, planId, periodKey, amount, currency, sourceNote, ctx.actor.user.userId).run();
  }
  await audit(ctx, existing ? "sprint7.budget.updated" : "sprint7.budget.created", "budget_entry", budgetId,
    { planId, periodKey, version: existing ? version + 1 : 1, amount, currency, sourceNote, previous: existing ?? null }).run();
  await updateProgress(ctx, "ejecucion", "Plan y presupuesto en borrador; revisión humana pendiente.");
  revalidatePath(planPath);
  redirect(`${planPath}?saved=1#budget-${planId}`);
}

export async function saveAreaScorecard(form: FormData) {
  const ctx = await context(kpiPath);
  const id = field(form, "id"), version = Number(field(form, "version"));
  const name = field(form, "name");
  const objectiveIds = [...new Set(form.getAll("objective_id").map(String).map((value) => value.trim()).filter(Boolean))];
  const [areas, objectives] = await Promise.all([getAreaScorecards(ctx.cycle.id), getObjectives(ctx.strategy.id)]);
  const existing = id ? areas.find((area) => area.id === id) : undefined;
  if (id && (!existing || existing.version !== version || existing.status !== "draft")) fail(kpiPath, "stale");
  if (!id && areas.length >= 3) fail(kpiPath, "areas");
  const issues = areaIssues({ name, objectiveIds }, objectives.filter((item) => item.status === "approved").map((item) => item.id),
    areas.filter((area) => area.id !== id).map((area) => area.name));
  if (issues.includes("nombre de área") || issues.includes("área duplicada") || issues.includes("objetivo desconocido"))
    fail(kpiPath, "area");
  const areaId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    const result = await ctx.db.prepare("UPDATE area_scorecards SET name = ?, objective_ids_json = ?, version = version + 1, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND cycle_id = ? AND version = ? AND status = 'draft' AND NOT EXISTS (SELECT 1 FROM area_scorecards other WHERE other.cycle_id = ? AND other.id != ? AND lower(trim(other.name)) = lower(trim(?)))")
      .bind(name, JSON.stringify(objectiveIds), ctx.actor.user.userId, areaId, ctx.cycle.id, version,
        ctx.cycle.id, areaId, name).run();
    if (result.meta.changes !== 1) fail(kpiPath, "stale");
  } else {
    const result = await ctx.db.prepare("INSERT INTO area_scorecards (id, cycle_id, name, objective_ids_json, updated_by_user_id) SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM area_scorecards WHERE cycle_id = ?) < 3 AND NOT EXISTS (SELECT 1 FROM area_scorecards WHERE cycle_id = ? AND lower(trim(name)) = lower(trim(?)))")
      .bind(areaId, ctx.cycle.id, name, JSON.stringify(objectiveIds), ctx.actor.user.userId,
        ctx.cycle.id, ctx.cycle.id, name).run();
    if (result.meta.changes !== 1) fail(kpiPath, "areas");
  }
  await audit(ctx, existing ? "sprint7.area_cmi.updated" : "sprint7.area_cmi.created", "area_scorecard", areaId,
    { version: existing ? version + 1 : 1, name, objectiveIds, previous: existing ?? null }).run();
  await updateProgress(ctx, "kpis", "Fichas KPI y CMI en borrador; revisión humana pendiente.");
  revalidatePath(kpiPath);
  redirect(`${kpiPath}?saved=1#cmi-${areaId}`);
}
