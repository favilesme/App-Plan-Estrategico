import Link from "next/link";
import { redirect } from "next/navigation";
import { saveAreaScorecard, saveBudgetEntry, saveExecutionPlan, saveKpiSpec } from "@/app/sprint7-actions";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { canRead, getActor } from "@/lib/authz";
import { getApprovedStrategy, getInitiatives, getObjectives, type StrategicObjective } from "@/lib/sprint6";
import { getAreaScorecards, getBudgetEntries, getExecutionPlans, getKpiSpecs,
  type AreaScorecard, type BudgetEntry, type ExecutionPlan, type KpiSpec } from "@/lib/sprint7";
import { areaIssues, BUDGET_PERIODS, budgetIssues, kpiIssues, kpiReadiness, planIssues,
  type Milestone } from "@/lib/sprint7-policy.mts";
import { getCurrentCycle, getMembers, getModuleProgress, type Member } from "@/lib/workspace";

const card = "rounded-2xl border border-[#E6DFD6] bg-white p-5";
const input = "mt-1 w-full rounded-lg border border-[#C9C5BF] bg-white px-3 py-2 text-sm text-[#192538]";
const button = "rounded-lg bg-[#192538] px-4 py-2 text-sm font-semibold text-white hover:bg-[#344052]";
type Query = Promise<{ error?: string; saved?: string }>;

async function pageData(slug: "ejecucion" | "kpis") {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath(`/modulos/${slug}`));
  if (!canRead(actor.role) || !actor.organizationId) return { actor, denied: true as const };
  const cycle = await getCurrentCycle(actor.organizationId);
  const strategy = cycle && await getApprovedStrategy(cycle.id);
  const [objectives, initiatives, plans, kpis, budgets, areas, members, progress] = await Promise.all([
    strategy ? getObjectives(strategy.id) : Promise.resolve([]),
    cycle ? getInitiatives(cycle.id) : Promise.resolve([]),
    cycle ? getExecutionPlans(cycle.id) : Promise.resolve([]),
    cycle ? getKpiSpecs(cycle.id) : Promise.resolve([]),
    cycle ? getBudgetEntries(cycle.id) : Promise.resolve([]),
    cycle ? getAreaScorecards(cycle.id) : Promise.resolve([]),
    getMembers(actor.organizationId),
    cycle ? getModuleProgress(cycle.id) : Promise.resolve([]),
  ]);
  const sourcesApproved = Boolean(strategy && progress.some((item) => item.module_slug === "objetivos" && item.status === "approved") &&
    progress.some((item) => item.module_slug === "iniciativas" && item.status === "approved") &&
    objectives.length && initiatives.length && objectives.every((item) => item.status === "approved") &&
    initiatives.every((item) => item.status === "approved"));
  const member = members.find((item) => item.id === actor.memberId && item.status === "active");
  const canEdit = Boolean(sourcesApproved && member?.is_leader && ["owner", "admin", "leader"].includes(member.role));
  return { actor, denied: false as const, cycle, strategy, objectives, initiatives, plans, kpis, budgets, areas, members,
    sourcesApproved, canEdit };
}

function periodLabel(key: string) {
  return key.startsWith("Y1-M") ? `Año 1 · mes ${Number(key.slice(4))}` : key === "Y2" ? "Año 2 · anual" : "Año 3 · anual";
}

function BudgetPanel({ plan, entries, canEdit }: { plan: ExecutionPlan; entries: BudgetEntry[]; canEdit: boolean }) {
  const complete = BUDGET_PERIODS.filter((key) => { const item = entries.find((row) => row.period_key === key);
    return item && budgetIssues({ periodKey: key, amount: item.amount, currency: item.currency, sourceNote: item.source_note }).length === 0; }).length;
  const currencies = [...new Set(entries.filter((row) => row.currency).map((row) => row.currency))];
  return <details id={`budget-${plan.id}`} className="mt-4 border-t border-[#E6DFD6] pt-4">
    <summary className="cursor-pointer text-sm font-semibold underline">Presupuesto · {complete}/14 períodos completos</summary>
    <p className="mt-2 text-xs text-[#5A626F]">El año 1 usa 12 meses desde el inicio del ciclo; años 2 y 3 usan un importe anual. Moneda y sustento proceden del cliente. {currencies.length > 1 ? "[FALTA] Unificar moneda antes de agregar importes." : ""}</p>
    <div className="mt-3 space-y-2">{BUDGET_PERIODS.map((key) => { const item = entries.find((row) => row.period_key === key);
      const issues = item ? budgetIssues({ periodKey: key, amount: item.amount, currency: item.currency, sourceNote: item.source_note }) : ["importe", "moneda", "sustento"];
      return <div key={key} className="rounded-lg bg-[#FAF8F4] p-3 text-sm"><p className="font-semibold">{periodLabel(key)} · {item?.amount || "[FALTA]"} {item?.currency || ""}</p>
        <p className="text-xs text-[#5A626F]">{item?.source_note || "[FALTA] Sustento"} · {issues.length ? `Pendiente: ${issues.join(", ")}` : "Completo para revisión"}</p>
        {canEdit && <form action={saveBudgetEntry} className="mt-2 grid gap-2 sm:grid-cols-[1fr_110px_2fr_auto]">
          <input type="hidden" name="id" value={item?.id ?? ""}/><input type="hidden" name="version" value={item?.version ?? 0}/>
          <input type="hidden" name="plan_id" value={plan.id}/><input type="hidden" name="period_key" value={key}/>
          <label className="text-xs">Importe<input name="amount" inputMode="decimal" defaultValue={item?.amount ?? ""} className={input}/></label>
          <label className="text-xs">Moneda<input name="currency" defaultValue={item?.currency ?? ""} maxLength={3} className={input} placeholder="ISO"/></label>
          <label className="text-xs">Sustento<input name="source_note" defaultValue={item?.source_note ?? ""} maxLength={1000} className={input}/></label>
          <button className={`${button} self-end`}>Guardar</button>
        </form>}
      </div>; })}</div>
  </details>;
}

function name(id: string | null, members: Member[]) {
  return members.find((member) => member.id === id)?.display_name || "[FALTA]";
}

function milestones(plan?: ExecutionPlan): Milestone[] {
  try {
    const parsed: unknown = JSON.parse(plan?.milestones_json ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is Milestone =>
      typeof item === "object" && item !== null && typeof item.date === "string" && typeof item.name === "string") : [];
  } catch { return []; }
}

function PlanForm({ initiativeId, defaultResponsible, plan, members }: { initiativeId: string;
  defaultResponsible: string; plan?: ExecutionPlan; members: Member[] }) {
  return <form action={saveExecutionPlan} className="mt-4 grid gap-3 border-t border-[#E6DFD6] pt-4 sm:grid-cols-2">
    <input type="hidden" name="id" value={plan?.id ?? ""}/><input type="hidden" name="version" value={plan?.version ?? 0}/>
    <input type="hidden" name="initiative_id" value={initiativeId}/>
    <label className="text-sm font-medium">Responsable de ejecución<select name="responsible_member_id" defaultValue={plan?.responsible_member_id ?? defaultResponsible} className={input}>
      <option value="">[FALTA] Asignar</option>{members.filter((item) => item.status === "active").map((item) =>
        <option key={item.id} value={item.id}>{item.display_name}</option>)}
    </select></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Inicio<input type="date" name="start_date" defaultValue={plan?.start_date ?? ""} className={input}/></label>
      <label className="text-sm font-medium">Cierre<input type="date" name="end_date" defaultValue={plan?.end_date ?? ""} className={input}/></label></div>
    <label className="text-sm font-medium sm:col-span-2">Hitos y fechas, uno por línea: AAAA-MM-DD | Hito<textarea name="milestones" rows={3}
      defaultValue={milestones(plan).map((item) => `${item.date} | ${item.name}`).join("\n")} className={input}/></label>
    <label className="text-sm font-medium sm:col-span-2">Recursos necesarios<textarea name="resources" rows={2} defaultValue={plan?.resources ?? ""} maxLength={3000} className={input}/></label>
    <label className="text-sm font-medium sm:col-span-2">Riesgos, condiciones y evidencia pendiente<textarea name="risks" rows={3} defaultValue={plan?.risks ?? ""} maxLength={3000} className={input}/></label>
    <p className="text-xs text-[#5A626F] sm:col-span-2">Los campos sin sustento pueden guardarse vacíos en borrador. No se habilita ejecución ni aprobación automática.</p>
    <button className={`${button} w-fit sm:col-span-2`}>Guardar borrador del plan</button>
  </form>;
}

export async function ExecutionPage({ searchParams }: { searchParams: Query }) {
  const query = await searchParams, data = await pageData("ejecucion");
  if (data.denied) return <AccessNotice configured={data.actor.role !== "unconfigured"}/>;
  const { initiatives, objectives, plans, budgets, members, sourcesApproved, canEdit } = data;
  return <AppShell active="ejecucion"><main className="mx-auto max-w-6xl space-y-5 px-5 py-8 lg:px-9">
    <Link href="/modulos/iniciativas" className="text-sm font-semibold underline">← Iniciativas aprobadas</Link>
    <header><p className="text-xs font-semibold uppercase tracking-widest text-[#5A626F]">Sprint 7 · Borradores operativos</p>
      <h1 className="mt-2 font-serif text-3xl text-[#192538]">Plan de ejecución</h1><p className="mt-2 text-sm text-[#5A626F]">Cada plan nace de una iniciativa aprobada y conserva la versión del objetivo. Registra responsable, hitos, fechas, recursos y riesgos con datos del cliente.</p></header>
    {query.error && <p role="alert" className="rounded-lg bg-[#FBF0EA] p-3 text-sm text-[#7E3527]">{query.error === "permission" ? "No tienes permiso para editar planes." : query.error === "source" ? "Se requieren objetivos e iniciativas aprobados y vigentes." : query.error === "stale" ? "Esta ficha cambió. Recarga la página antes de guardar." : query.error === "responsible" ? "El responsable debe ser integrante activo de esta organización." : query.error === "budget" ? "Revisa período, importe, moneda y sustento del presupuesto." : "Revisa fechas, hitos y límites de texto."}</p>}
    {query.saved && <p role="status" className="rounded-lg bg-[#EAF3EC] p-3 text-sm">Borrador guardado con versión y auditoría.</p>}
    {!sourcesApproved && <section className={card}>[FALTA] Aprobación vigente de objetivos e iniciativas para este ciclo.</section>}
    {sourcesApproved && <section className={card}><h2 className="font-semibold">Cobertura de ejecución · {plans.length}/{initiatives.length}</h2>
      <p className="mt-2 text-sm text-[#5A626F]">{initiatives.length - plans.length} iniciativas sin ficha. Un borrador con campos pendientes no cumple aún el criterio de salida. El presupuesto exige 14 períodos por plan.</p></section>}
    {sourcesApproved && initiatives.map((initiative) => { const objective = objectives.find((item) => item.id === initiative.objective_id);
      const plan = plans.find((item) => item.initiative_id === initiative.id);
      const items = milestones(plan);
      const sourceCurrent = !plan || Boolean(objective && plan.initiative_version === initiative.version &&
        plan.objective_id === objective.id && plan.objective_version === objective.version);
      const issues = plan ? planIssues({ startDate: plan.start_date ?? "", endDate: plan.end_date ?? "",
        milestones: items, resources: plan.resources, risks: plan.risks,
        responsibleMemberId: plan.responsible_member_id ?? "" }) : [];
      if (!sourceCurrent) issues.unshift("versión de origen");
      return <section key={initiative.id} id={plan ? `plan-${plan.id}` : undefined} className={card}>
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-semibold">{initiative.statement}</h2>
          <span className="text-xs font-semibold text-[#5A626F]">{plan ? `Borrador v${plan.version}` : "[FALTA] Plan"}</span></div>
        <p className="mt-2 text-sm"><strong>Objetivo aprobado:</strong> {objective?.statement ?? "[FALTA]"}</p>
        <p className="mt-1 text-xs text-[#5A626F]">Origen: iniciativa v{initiative.version} · objetivo v{objective?.version ?? "?"}. Responsable de la iniciativa: {name(initiative.responsible_member_id, members)}.</p>
        {plan && <div className="mt-3 space-y-1 text-sm"><p><strong>Responsable del plan:</strong> {name(plan.responsible_member_id, members)}</p>
          <p><strong>Fechas:</strong> {plan.start_date || "[FALTA]"} → {plan.end_date || "[FALTA]"}</p>
          <p><strong>Hitos:</strong> {items.length ? items.map((item) => `${item.date}: ${item.name}`).join(" · ") : "[FALTA]"}</p>
          <p><strong>Recursos:</strong> {plan.resources || "[FALTA]"}</p><p><strong>Riesgos y condiciones:</strong> {plan.risks || "[FALTA]"}</p>
          <p className="text-xs text-[#5A626F]">{issues.length ? `Pendiente: ${issues.join(", ")}.` : "Ficha completa para revisión humana; sin aprobación."} Última edición: {plan.updated_at}.</p></div>}
        {canEdit && sourceCurrent && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold underline">{plan ? "Editar borrador" : "Crear ficha"}</summary>
          <PlanForm initiativeId={initiative.id} defaultResponsible={initiative.responsible_member_id} plan={plan} members={members}/></details>}
        {plan && <BudgetPanel plan={plan} entries={budgets.filter((item) => item.plan_id === plan.id)} canEdit={canEdit && sourceCurrent}/>}
      </section>; })}
    <Link href="/modulos/kpis" className="inline-block text-sm font-semibold underline">Continuar a fichas KPI →</Link>
  </main></AppShell>;
}

function KpiForm({ objectiveId, spec, members }: { objectiveId: string; spec?: KpiSpec; members: Member[] }) {
  return <form action={saveKpiSpec} className="mt-4 grid gap-3 border-t border-[#E6DFD6] pt-4 sm:grid-cols-2">
    <input type="hidden" name="id" value={spec?.id ?? ""}/><input type="hidden" name="version" value={spec?.version ?? 0}/>
    <input type="hidden" name="objective_id" value={objectiveId}/>
    <label className="text-sm font-medium sm:col-span-2">Fórmula y variables<textarea name="formula" rows={2} defaultValue={spec?.formula ?? ""} maxLength={1000} className={input}/></label>
    <label className="text-sm font-medium">¿La fórmula requiere denominador?<select name="requires_denominator" defaultValue={spec?.requires_denominator ? "yes" : "no"} className={input}><option value="no">No</option><option value="yes">Sí</option></select></label>
    <label className="text-sm font-medium">Definición del denominador<input name="denominator" defaultValue={spec?.denominator ?? ""} maxLength={500} className={input}/></label>
    <label className="text-sm font-medium sm:col-span-2">Fuente y evidencia del dato<textarea name="source" rows={2} defaultValue={spec?.source ?? ""} maxLength={1000} className={input}/></label>
    <label className="text-sm font-medium">Línea base<input name="baseline" inputMode="decimal" defaultValue={spec?.baseline ?? ""} className={input}/></label>
    <label className="text-sm font-medium">Meta<input name="target" defaultValue={spec?.target ?? ""} className={input}/></label>
    <label className="text-sm font-medium">Frecuencia<input name="frequency" defaultValue={spec?.frequency ?? ""} maxLength={120} className={input}/></label>
    <label className="text-sm font-medium">Responsable<select name="responsible_member_id" defaultValue={spec?.responsible_member_id ?? ""} className={input}>
      <option value="">[FALTA] Asignar</option>{members.filter((item) => item.status === "active").map((item) =>
        <option key={item.id} value={item.id}>{item.display_name}</option>)}
    </select></label>
    <label className="text-sm font-medium">Sentido de interpretación<select name="direction" defaultValue={spec?.direction ?? ""} className={input}>
      <option value="">[FALTA] Elegir</option><option value="higher">Más es mejor</option><option value="lower">Menos es mejor</option><option value="range">Rango objetivo</option>
    </select></label>
    <label className="text-sm font-medium">Límite de atención<input name="tolerance" defaultValue={spec?.tolerance ?? ""} className={input}/></label>
    <p className="text-xs text-[#5A626F] sm:col-span-2">Para un rango, escribe meta y tolerancia como mínimo..máximo. La tolerancia debe contener la meta. Para un valor único, el límite de atención debe estar del lado desfavorable de la meta. No se crea un porcentaje universal.</p>
    <label className="text-sm font-medium sm:col-span-2">Fundamento de la tolerancia<textarea name="tolerance_rationale" rows={2} defaultValue={spec?.tolerance_rationale ?? ""} maxLength={1500} className={input}/></label>
    <button className={`${button} w-fit sm:col-span-2`}>Guardar ficha KPI en borrador</button>
  </form>;
}

function areaObjectiveIds(area?: AreaScorecard): string[] {
  try {
    const parsed: unknown = JSON.parse(area?.objective_ids_json ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

function AreaForm({ area, objectives }: { area?: AreaScorecard; objectives: StrategicObjective[] }) {
  const selected = areaObjectiveIds(area);
  return <form action={saveAreaScorecard} className="mt-3 space-y-3 border-t border-[#E6DFD6] pt-3">
    <input type="hidden" name="id" value={area?.id ?? ""}/><input type="hidden" name="version" value={area?.version ?? 0}/>
    <label className="block text-sm font-medium">Nombre del área elegido por el cliente<input name="name" defaultValue={area?.name ?? ""} minLength={3} maxLength={120} required className={input}/></label>
    <fieldset><legend className="text-sm font-medium">KPI de objetivos asignados a esta área</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{objectives.map((objective) =>
        <label key={objective.id} className="flex items-start gap-2 rounded-lg bg-[#FAF8F4] p-2 text-sm">
          <input type="checkbox" name="objective_id" value={objective.id} defaultChecked={selected.includes(objective.id)} className="mt-1"/>
          <span>{objective.kpi_name} · {objective.statement}</span></label>)}</div></fieldset>
    <button className={button}>Guardar CMI de área en borrador</button>
  </form>;
}

function ScorecardsPanel({ areas, objectives, kpis, canEdit }: { areas: AreaScorecard[];
  objectives: StrategicObjective[]; kpis: KpiSpec[]; canEdit: boolean }) {
  const ready = kpis.filter((spec) => kpiReadiness({ formula: spec.formula, denominator: spec.denominator,
    requiresDenominator: Boolean(spec.requires_denominator), source: spec.source, baseline: spec.baseline,
    target: spec.target, frequency: spec.frequency, responsibleMemberId: spec.responsible_member_id ?? "",
    direction: spec.direction, tolerance: spec.tolerance, toleranceRationale: spec.tolerance_rationale }) === "lista_para_revision").length;
  return <section className={card}><h2 className="text-lg font-semibold">Cuadros de Mando Integral · {1 + areas.length}/4</h2>
    <p className="mt-2 text-sm text-[#5A626F]">CMI corporativo y tres áreas que debe elegir el cliente. La asignación de KPI no crea metas ni aprueba tolerancias.</p>
    <div className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-sm"><strong>Corporativo:</strong> {kpis.length}/{objectives.length} fichas KPI creadas · {ready} completas para revisión. Incluye todos los objetivos aprobados.</div>
    {areas.map((area) => { const ids = areaObjectiveIds(area);
      const issues = areaIssues({ name: area.name, objectiveIds: ids }, objectives.map((item) => item.id),
        areas.filter((item) => item.id !== area.id).map((item) => item.name));
      const missingSpecs = ids.filter((id) => !kpis.some((item) => item.objective_id === id));
      return <div key={area.id} id={`cmi-${area.id}`} className="mt-3 rounded-lg border border-[#E6DFD6] p-3 text-sm">
        <strong>{area.name}</strong> · borrador v{area.version} · {ids.length} KPI asignados
        <p className="mt-1 text-xs text-[#5A626F]">{issues.length || missingSpecs.length ?
          `Pendiente: ${[...issues, ...(missingSpecs.length ? ["fichas KPI de objetivos asignados"] : [])].join(", ")}.` :
          "Composición completa para revisión humana; sin aprobación."}</p>
        {canEdit && <details className="mt-2"><summary className="cursor-pointer font-semibold underline">Editar área y KPI</summary><AreaForm area={area} objectives={objectives}/></details>}
      </div>; })}
    {canEdit && areas.length < 3 && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold underline">Añadir área elegida por el cliente</summary><AreaForm objectives={objectives}/></details>}
    {areas.length < 3 && <p className="mt-3 text-sm text-[#7E3527]">[FALTA] {3 - areas.length} área(s) para completar los cuatro CMI.</p>}
  </section>;
}

export async function KpisPage({ searchParams }: { searchParams: Query }) {
  const query = await searchParams, data = await pageData("kpis");
  if (data.denied) return <AccessNotice configured={data.actor.role !== "unconfigured"}/>;
  const { objectives, kpis, areas, members, sourcesApproved, canEdit } = data;
  return <AppShell active="kpis"><main className="mx-auto max-w-6xl space-y-5 px-5 py-8 lg:px-9">
    <Link href="/modulos/ejecucion" className="text-sm font-semibold underline">← Plan de ejecución</Link>
    <header><p className="text-xs font-semibold uppercase tracking-widest text-[#5A626F]">Sprint 7 · Fichas operativas</p>
      <h1 className="mt-2 font-serif text-3xl text-[#192538]">KPIs por objetivo</h1><p className="mt-2 text-sm text-[#5A626F]">La identidad y unidad de cada indicador proceden del objetivo aprobado. Completa fórmula, fuente, base, meta, frecuencia, responsable, sentido y tolerancia propia.</p></header>
    {query.error && <p role="alert" className="rounded-lg bg-[#FBF0EA] p-3 text-sm text-[#7E3527]">{query.error === "permission" ? "No tienes permiso para editar KPI." : query.error === "source" ? "Se requieren objetivos e iniciativas aprobados y vigentes." : query.error === "stale" ? "Esta ficha cambió. Recarga antes de guardar." : query.error === "responsible" ? "El responsable debe ser integrante activo." : query.error === "area" ? "Revisa el nombre del área y sus KPI; no repitas un área existente." : query.error === "areas" ? "Ya existen tres CMI de área." : "Revisa el formato de números, rango y tolerancia."}</p>}
    {query.saved && <p role="status" className="rounded-lg bg-[#EAF3EC] p-3 text-sm">Ficha KPI guardada en borrador con versión y auditoría.</p>}
    {!sourcesApproved && <section className={card}>[FALTA] Aprobación vigente de objetivos e iniciativas para este ciclo.</section>}
    {sourcesApproved && <section className={card}><h2 className="font-semibold">Cobertura KPI · {kpis.length}/{objectives.length}</h2><p className="mt-2 text-sm text-[#5A626F]">Cada objetivo requiere una ficha. Una ficha completa queda lista para revisión humana; todavía no clasifica mediciones.</p></section>}
    {sourcesApproved && <ScorecardsPanel areas={areas} objectives={objectives} kpis={kpis} canEdit={canEdit}/>}
    {sourcesApproved && objectives.map((objective) => { const spec = kpis.find((item) => item.objective_id === objective.id);
      const sourceCurrent = !spec || spec.objective_version === objective.version;
      const issues = spec ? kpiIssues({ formula: spec.formula, denominator: spec.denominator,
        requiresDenominator: Boolean(spec.requires_denominator), source: spec.source, baseline: spec.baseline,
        target: spec.target, frequency: spec.frequency, responsibleMemberId: spec.responsible_member_id ?? "",
        direction: spec.direction, tolerance: spec.tolerance, toleranceRationale: spec.tolerance_rationale }) : [];
      if (!sourceCurrent) issues.unshift("versión del objetivo");
      const readiness = spec && sourceCurrent ? kpiReadiness({ formula: spec.formula, denominator: spec.denominator,
        requiresDenominator: Boolean(spec.requires_denominator), source: spec.source, baseline: spec.baseline,
        target: spec.target, frequency: spec.frequency, responsibleMemberId: spec.responsible_member_id ?? "",
        direction: spec.direction, tolerance: spec.tolerance, toleranceRationale: spec.tolerance_rationale }) : "pendiente";
      return <section key={objective.id} id={spec ? `kpi-${spec.id}` : undefined} className={card}>
        <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">{objective.kpi_name} · {objective.kpi_unit}</h2><span className="text-xs font-semibold text-[#5A626F]">{spec ? `Borrador v${spec.version}` : "[FALTA] Ficha"}</span></div>
        <p className="mt-2 text-sm"><strong>Objetivo:</strong> {objective.statement}</p><p className="mt-1 text-sm"><strong>Propósito aprobado:</strong> {objective.kpi_definition}</p>
        <p className="mt-1 text-xs text-[#5A626F]">Origen: objetivo aprobado v{objective.version}. Estado operativo: {readiness.replaceAll("_", " ")}.</p>
        {spec && <div className="mt-3 space-y-1 text-sm"><p><strong>Fórmula:</strong> {spec.formula || "[FALTA]"}</p>
          <p><strong>Denominador:</strong> {spec.requires_denominator ? spec.denominator || "[FALTA]" : "No requerido según la ficha"}</p>
          <p><strong>Fuente:</strong> {spec.source || "[FALTA]"}</p><p><strong>Línea base:</strong> {spec.baseline || "[FALTA]"} · <strong>Meta:</strong> {spec.target || "[FALTA]"}</p>
          <p><strong>Frecuencia:</strong> {spec.frequency || "[FALTA]"} · <strong>Responsable:</strong> {name(spec.responsible_member_id, members)}</p>
          <p><strong>Sentido:</strong> {spec.direction || "[FALTA]"} · <strong>Límite:</strong> {spec.tolerance || "[FALTA]"}</p>
          <p><strong>Fundamento del límite:</strong> {spec.tolerance_rationale || "[FALTA]"}</p>
          <p className="text-xs text-[#5A626F]">{issues.length ? `Pendiente: ${issues.join(", ")}.` : "Ficha completa para revisión humana; tolerancia no aprobada."} Última edición: {spec.updated_at}.</p></div>}
        {canEdit && sourceCurrent && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold underline">{spec ? "Editar borrador" : "Crear ficha"}</summary><KpiForm objectiveId={objective.id} spec={spec} members={members}/></details>}
      </section>; })}
  </main></AppShell>;
}
