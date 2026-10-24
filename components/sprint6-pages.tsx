import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { saveInitiative } from "@/app/sprint6-actions";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { ObjectiveForm } from "@/components/objective-form";
import { canRead, getActor } from "@/lib/authz";
import { getStrategicActions, type StrategicAction } from "@/lib/sprint5";
import { getMatrixSource } from "@/lib/sprint4";
import { bscCoverage, getApprovedStrategy, getInitiatives, getObjectives, parseIds, PERSPECTIVES,
  PERSPECTIVE_LABELS, type ApprovedStrategy, type StrategicInitiative, type StrategicObjective } from "@/lib/sprint6";
import { getConditions } from "@/lib/sprint5";
import { DIRECTION_LABELS } from "@/lib/mdep";
import { getCurrentCycle, getMembers, getOrganization, type Member } from "@/lib/workspace";
import { OBJECTIVE_VALIDATION_MESSAGES, type ObjectiveValidationCode } from "@/lib/sprint6-policy.mts";

const input = "mt-1 w-full rounded-lg border border-[#C9C5BF] bg-white px-3 py-2 text-sm text-[#192538]";
const button = "rounded-lg bg-[#192538] px-4 py-2 text-sm font-semibold text-white hover:bg-[#344052]";
const card = "rounded-2xl border border-[#E6DFD6] bg-white p-5";

type Query = Promise<{ error?: string; saved?: string }>;
type SourceEvidence = { id: string; statement: string; source_detail: string; factorCode: string };

async function pageData(slug: "objetivos" | "iniciativas") {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath(`/modulos/${slug}`));
  if (!canRead(actor.role)) return { actor, denied: true as const };
  const org = await getOrganization();
  const cycle = org && await getCurrentCycle(org.id);
  const strategy = cycle && await getApprovedStrategy(cycle.id);
  const [actions, objectives, initiatives, members, conditions, source] = await Promise.all([
    strategy ? getStrategicActions(strategy.action_set_id) : Promise.resolve([]),
    strategy ? getObjectives(strategy.id) : Promise.resolve([]),
    cycle ? getInitiatives(cycle.id) : Promise.resolve([]),
    org ? getMembers(org.id) : Promise.resolve([]),
    strategy ? getConditions(strategy.id) : Promise.resolve([]),
    strategy ? getMatrixSource(strategy.source_snapshot_id) : Promise.resolve(null),
  ]);
  const evidence = new Map<string, SourceEvidence>(source?.data.factors.flatMap((factor) =>
    factor.evidence.map((item) => [item.id, { id: item.id, statement: item.statement,
      source_detail: item.source_detail, factorCode: factor.code }] as const)) ?? []);
  const canEdit = members.some((item) => item.id === actor.memberId && item.status === "active" &&
    item.is_leader && ["owner", "admin", "leader"].includes(item.role));
  return { actor, denied: false as const, org, cycle, strategy, actions, objectives, initiatives, members,
    conditions, evidence, canEdit };
}

function StrategyContext({ strategy, condition }: { strategy: ApprovedStrategy; condition?: { status: string; rationale: string; source_detail: string } }) {
  return <section className={`${card} border-[#D6A871] bg-[#FBF5EB]`}>
    <p className="text-xs font-semibold uppercase tracking-widest text-[#5A626F]">Decisión del cliente · Sprint 5</p>
    <h2 className="mt-2 text-lg font-semibold">{strategy.choice_direction === "enfoque" ? `Enfoque con ${strategy.focus_advantage === "diferenciacion" ? "diferenciación" : "costes"} dentro del segmento` : strategy.choice_direction ? DIRECTION_LABELS[strategy.choice_direction] : "Dirección competitiva aprobada"}</h2>
    <p className="mt-2 text-sm"><strong>Segmento:</strong> {strategy.focus_segment || "[FALTA]"}</p>
    <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Decisión y restricciones:</strong> {strategy.choice_rationale}</p>
    {condition && <p className="mt-2 text-sm"><strong>Condición MDEP:</strong> {condition.status === "met" ? "registrada como cumplida" : condition.status} · {condition.rationale}. Fuente consignada: {condition.source_detail}. La verificación independiente de la fuente externa queda pendiente.</p>}
    <p className="mt-2 text-xs text-[#5A626F]">MDEP aprobada · revisión {strategy.revision} · {strategy.approved_at ?? "fecha no disponible"}. La rentabilidad, la aceptación de la oferta y la capacidad operativa deben seguir visibles al formular objetivos e iniciativas.</p>
  </section>;
}

function SourceList({ ids, actions, evidence }: { ids: string[]; actions: StrategicAction[]; evidence: Map<string, SourceEvidence> }) {
  return <div className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#5A626F]">
    <p className="font-semibold text-[#192538]">Trazabilidad de origen</p>
    {ids.map((id) => { const action = actions.find((item) => item.id === id); if (!action) return null;
      return <div key={id} className="mt-2"><p><strong>Acción {action.quadrant}, v{action.version}:</strong> {action.statement}</p>
        {parseIds(action.evidence_ids_json).map((evidenceId) => { const item = evidence.get(evidenceId);
          return <p key={evidenceId} className="ml-3">{item ? `${item.factorCode}: ${item.statement} · fuente declarada: ${item.source_detail}` : `Referencia ${evidenceId} · [FALTA] detalle de evidencia`}</p>; })}
        {!parseIds(action.evidence_ids_json).length && <p className="ml-3">[FALTA] Evidencia vinculada en la acción original.</p>}
      </div>; })}
  </div>;
}

export async function ObjectivesPage({ searchParams }: { searchParams: Query }) {
  const query = await searchParams, data = await pageData("objetivos");
  if (data.denied) return <AccessNotice configured={data.actor.role !== "unconfigured"}/>;
  const { strategy, actions, objectives, conditions, evidence, canEdit } = data;
  const coverage = bscCoverage(objectives);
  return <AppShell active="objetivos"><main className="mx-auto max-w-6xl space-y-5 px-5 py-8 lg:px-9">
    <Link href="/modulos/porter" className="text-sm font-semibold underline">← Dirección competitiva</Link>
    <header><p className="text-xs font-semibold uppercase tracking-widest text-[#5A626F]">Sprint 6 · Formulación</p><h1 className="mt-2 font-serif text-3xl text-[#192538]">Objetivos estratégicos</h1>
      <p className="mt-2 text-sm text-[#5A626F]">Los borradores los formula el cliente desde la decisión aprobada. El consultor revisará el contenido antes de su aprobación final.</p></header>
    {query.error && <p role="alert" className="rounded-lg bg-[#FBF0EA] p-3 text-sm text-[#7E3527]">{query.error in OBJECTIVE_VALIDATION_MESSAGES
      ? OBJECTIVE_VALIDATION_MESSAGES[query.error as ObjectiveValidationCode]
      : query.error === "duplicate" ? "Ya existe un objetivo con ese texto en este ciclo."
      : query.error === "linked" ? "Una iniciativa usa una acción que intentas quitar del objetivo."
      : query.error === "evidence" ? "Las acciones elegidas no tienen referencias de evidencia. Registra la evidencia de origen antes de formular el objetivo."
      : query.error === "stale" ? "Esta versión cambió. Actualiza la página antes de guardar."
      : query.error === "permission" ? "Tu cuenta no tiene permiso para formular objetivos en este ciclo."
      : query.error === "source" ? "No hay una dirección competitiva aprobada para este ciclo."
      : "No se guardó el objetivo. Revisa los campos y las acciones vinculadas."}</p>}
    {query.saved && <p role="status" className="rounded-lg bg-[#EAF3EC] p-3 text-sm">Objetivo guardado en borrador con trazabilidad y versión.</p>}
    {!strategy ? <section className={card}><h2 className="font-semibold">Dependencia pendiente</h2><p className="mt-2 text-sm">Primero debe quedar aprobada la dirección competitiva del ciclo.</p></section> : <>
      <StrategyContext strategy={strategy} condition={conditions.find((item) => item.direction === strategy.choice_direction)}/>
      <section className={card}><h2 className="text-lg font-semibold">Cobertura Balanced Scorecard · {coverage.count}/4</h2><p className="mt-2 text-sm">Para completar la propuesta debe existir al menos un objetivo en cada perspectiva. Estado actual: borrador.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{PERSPECTIVES.map((key) => <div key={key} className="rounded-lg bg-[#FAF8F4] p-3 text-sm"><strong>{PERSPECTIVE_LABELS[key]}:</strong> {objectives.filter((item) => item.perspective === key).length || "[FALTA]"}</div>)}</div>
        {coverage.missing.length === 0 && <p className="mt-3 text-sm font-semibold text-[#31523B]">Las cuatro perspectivas tienen objetivos. Revisión humana pendiente.</p>}
      </section>
      {objectives.map((item) => <section key={item.id} id={`objetivo-${item.id}`} className={card}><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">{item.statement}</h2><span className="text-xs text-[#5A626F]">{PERSPECTIVE_LABELS[item.perspective]} · borrador v{item.version}</span></div>
        <p className="mt-2 text-sm"><strong>Resultado:</strong> {item.desired_result}</p><p className="mt-1 text-sm"><strong>Vínculo estratégico:</strong> {item.strategy_link}</p>
        <p className="mt-1 text-sm"><strong>Fundamento y límites:</strong> {item.evidence_note}</p><p className="mt-1 text-sm"><strong>KPI propio:</strong> {item.kpi_name} ({item.kpi_unit}) · {item.kpi_definition}</p>
        <SourceList ids={parseIds(item.source_action_ids_json)} actions={actions} evidence={evidence}/>
        <p className="mt-2 text-xs text-[#5A626F]">Autor de última edición: {item.updated_by_user_id} · {item.updated_at}</p>
        {canEdit && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold underline">Editar borrador</summary><ObjectiveForm item={item} actions={actions}/></details>}
      </section>)}
      {canEdit && <section className={card}><h2 className="text-lg font-semibold">Añadir objetivo</h2><ObjectiveForm actions={actions}/></section>}
      {coverage.count === 4 && <Link href="/modulos/iniciativas" className="inline-block text-sm font-semibold underline">Continuar a iniciativas →</Link>}
    </>}
  </main></AppShell>;
}

function InitiativeForm({ item, objectives, actions, members }: { item?: StrategicInitiative; objectives: StrategicObjective[]; actions: StrategicAction[]; members: Member[] }) {
  return <form action={saveInitiative} className="mt-4 space-y-3"><input type="hidden" name="id" value={item?.id ?? ""}/><input type="hidden" name="version" value={item?.version ?? 0}/>
    <label className="block text-sm font-medium">Objetivo estratégico<select name="objective_id" defaultValue={item?.objective_id ?? ""} className={input} required><option value="">Seleccionar objetivo</option>{objectives.map((objective) => <option key={objective.id} value={objective.id}>{PERSPECTIVE_LABELS[objective.perspective]} · {objective.statement}</option>)}</select></label>
    <label className="block text-sm font-medium">Acción aprobada de ese objetivo<select name="source_action_id" defaultValue={item?.source_action_id ?? ""} className={input} required><option value="">Seleccionar acción</option>{actions.map((action) => <option key={action.id} value={action.id}>{action.quadrant} · {action.statement}</option>)}</select></label>
    <p className="text-xs text-[#5A626F]">La acción elegida debe estar vinculada al objetivo. Se validará al guardar.</p>
    <label className="block text-sm font-medium">Iniciativa<input name="statement" defaultValue={item?.statement ?? ""} className={input} minLength={15} maxLength={300} required/></label>
    <label className="block text-sm font-medium">Resultado esperado<textarea name="expected_result" defaultValue={item?.expected_result ?? ""} className={input} minLength={15} maxLength={800} required/></label>
    <label className="block text-sm font-medium">Responsable<select name="responsible_member_id" defaultValue={item?.responsible_member_id ?? ""} className={input} required><option value="">Seleccionar responsable</option>{members.filter((member) => member.status === "active").map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
    <label className="block text-sm font-medium">Fundamento y evidencia para ejecutar<textarea name="evidence_note" defaultValue={item?.evidence_note ?? ""} className={input} minLength={15} maxLength={1000} required/></label>
    <button className={button}>{item ? "Guardar nueva versión de la iniciativa" : "Guardar iniciativa en borrador"}</button></form>;
}

export async function InitiativesPage({ searchParams }: { searchParams: Query }) {
  const query = await searchParams, data = await pageData("iniciativas");
  if (data.denied) return <AccessNotice configured={data.actor.role !== "unconfigured"}/>;
  const { strategy, objectives, actions, initiatives, members, conditions, evidence, canEdit } = data;
  const coverage = bscCoverage(objectives);
  return <AppShell active="iniciativas"><main className="mx-auto max-w-6xl space-y-5 px-5 py-8 lg:px-9"><Link href="/modulos/objetivos" className="text-sm font-semibold underline">← Objetivos estratégicos</Link>
    <header><p className="text-xs font-semibold uppercase tracking-widest text-[#5A626F]">Sprint 6 · Despliegue</p><h1 className="mt-2 font-serif text-3xl text-[#192538]">Iniciativas</h1><p className="mt-2 text-sm text-[#5A626F]">Cada iniciativa se vincula a un objetivo, una acción estratégica y un responsable. Permanecerá en borrador hasta revisión humana.</p></header>
    {query.error && <p role="alert" className="rounded-lg bg-[#FBF0EA] p-3 text-sm text-[#7E3527]">{query.error === "coverage" ? "Completa un objetivo en cada una de las cuatro perspectivas BSC antes de formular iniciativas." : query.error === "stale" ? "Esta versión cambió. Actualiza la página antes de guardar." : "No se guardó la iniciativa. Comprueba objetivo, acción vinculada, responsable y fundamento."}</p>}
    {query.saved && <p role="status" className="rounded-lg bg-[#EAF3EC] p-3 text-sm">Iniciativa guardada en borrador con trazabilidad y versión.</p>}
    {!strategy ? <section className={card}>Primero debe aprobarse la dirección competitiva del ciclo.</section> : <>
      <StrategyContext strategy={strategy} condition={conditions.find((item) => item.direction === strategy.choice_direction)}/>
      {coverage.count !== 4 && <section className={card}>La formulación de iniciativas se habilita cuando exista al menos un objetivo en cada perspectiva BSC. Cobertura actual: {coverage.count}/4. <Link href="/modulos/objetivos" className="underline">Abrir objetivos</Link>.</section>}
      {initiatives.map((item) => { const objective = objectives.find((goal) => goal.id === item.objective_id);
        return <section key={item.id} id={`iniciativa-${item.id}`} className={card}><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">{item.statement}</h2><span className="text-xs text-[#5A626F]">borrador v{item.version}</span></div>
          <p className="mt-2 text-sm"><strong>Objetivo:</strong> {objective?.statement ?? "[FALTA]"} · versión vinculada {item.objective_version}{objective && objective.version !== item.objective_version ? " · revisar vínculo tras cambio del objetivo" : ""}</p><p className="mt-1 text-sm"><strong>Resultado:</strong> {item.expected_result}</p>
          <p className="mt-1 text-sm"><strong>Responsable:</strong> {members.find((member) => member.id === item.responsible_member_id)?.display_name ?? "[FALTA]"}</p>
          <p className="mt-1 text-sm"><strong>Fundamento:</strong> {item.evidence_note}</p><p className="mt-1 text-sm"><strong>KPI del objetivo:</strong> {objective?.kpi_name ?? "[FALTA]"}</p>
          <SourceList ids={[item.source_action_id]} actions={actions} evidence={evidence}/>
          <p className="mt-2 text-xs text-[#5A626F]">Autor de última edición: {item.updated_by_user_id} · {item.updated_at}</p>
          {canEdit && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold underline">Editar borrador</summary><InitiativeForm item={item} objectives={objectives} actions={actions} members={members}/></details>}
        </section>; })}
      {canEdit && coverage.count === 4 && <section className={card}><h2 className="text-lg font-semibold">Añadir iniciativa</h2><InitiativeForm objectives={objectives} actions={actions} members={members}/></section>}
    </>}
  </main></AppShell>;
}
