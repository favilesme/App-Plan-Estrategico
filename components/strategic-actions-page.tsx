import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { approveStrategicActions, removeStrategicAction, reviewStrategicActions, saveActionScope,
  saveStrategicAction, startStrategicActions, voteStrategicActions } from "@/app/strategy-actions";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { canRead, getActor } from "@/lib/authz";
import { matrixVoteState, quadrantResults, vulnerabilityResult } from "@/lib/foda-matrix";
import { getFodaSet } from "@/lib/sprint3";
import { getMatrixScores, getMatrixSource, getMatrixVersions, getVulnerabilities } from "@/lib/sprint4";
import { getActionSet, getActionVotes, getStrategicActions, latestGate, type StrategicAction } from "@/lib/sprint5";
import { getCurrentCycle, getMembers, getOrganization } from "@/lib/workspace";

const input = "mt-1 w-full rounded-lg border border-[#C9C5BF] bg-white px-3 py-2 text-sm text-[#192538]";
const button = "rounded-lg bg-[#192538] px-4 py-2 text-sm font-semibold text-white hover:bg-[#344052] disabled:opacity-50";
const card = "rounded-2xl border border-[#E6DFD6] bg-white p-5";
const parse = (text: string) => { try { return JSON.parse(text) as string[]; } catch { return []; } };

export async function StrategicActionsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; approved?: string }> }) {
  const query = await searchParams;
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/modulos/formulacion"));
  if (!canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const org = await getOrganization();
  const cycle = org && await getCurrentCycle(org.id);
  const foda = cycle && await getFodaSet(cycle.id);
  const matrix = foda && (await getMatrixVersions(foda.id)).find((m) => m.set_version === foda.version);
  const source = matrix && await getMatrixSource(matrix.source_snapshot_id);
  const set = matrix && await getActionSet(matrix.id);
  const actions = set ? await getStrategicActions(set.id) : [];
  const votes = set ? await getActionVotes(set) : [];
  const members = org ? await getMembers(org.id) : [];
  const voteState = matrixVoteState(votes.map((v) => ({ ...v, matrix_id: v.action_set_id, matrix_revision: v.set_revision })), members);
  const review = cycle && set ? await latestGate(cycle.id, "strategy.actions", `${set.id}:r${set.revision}`) : null;
  const canEdit = set?.status === "draft" && members.some((m) => m.id === actor.memberId && m.status === "active" && m.is_leader);
  const isDirector = canEdit && members.some((m) => m.id === actor.memberId && m.is_director);
  const allScores = matrix ? await getMatrixScores(matrix.id) : [];
  const fo = source && quadrantResults(source.data, "FO", allScores);
  const da = source && quadrantResults(source.data, "DA", allScores);
  const priorities = new Map([...(fo?.internal ?? []), ...(fo?.external ?? []), ...(da?.internal ?? []), ...(da?.external ?? [])]
    .map((r) => [r.factor.id, `${r.priority} · promedio ${r.average?.toFixed(1)}`]));
  const vulnerabilities = matrix ? await getVulnerabilities(matrix.id) : [];
  const zones = new Map(vulnerabilities.map((v) => [v.weakness_factor_id, vulnerabilityResult(v)?.zone]));
  const factorById = new Map(source?.data.factors.map((f) => [f.id, f]) ?? []);
  const evidence = source?.data.factors.flatMap((f) => f.evidence.map((e) => ({ ...e, factor: f.code }))) ?? [];
  return <AppShell active="formulacion"><main className="mx-auto max-w-6xl space-y-6 px-5 py-8 lg:px-9">
    <Link href="/modulos/foda/matriz" className="text-sm font-semibold text-[#192538] underline">← FODA cuantitativa</Link>
    <header><p className="text-xs font-semibold uppercase tracking-widest text-[#5A626F]">Sprint 5 · Puente FODA–MDEP</p>
      <h1 className="mt-2 font-serif text-3xl text-[#192538]">Formulación estratégica</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5A626F]">Registra acciones concretas FO, FA, DO y DA. Cada acción debe indicar factores, evidencia, efecto esperado y prioridad propia de 1 a 5. Esa prioridad no cambia los puntajes FODA.</p></header>
    {query.error && <p role="alert" className="rounded-lg bg-[#FBF0EA] p-3 text-sm text-[#7E3527]">No se guardó el cambio ({query.error}). Revisa campos, permisos y versión; actualiza la página si otra persona editó.</p>}
    {query.saved && <p role="status" className="text-sm text-[#31523B]">Cambio guardado y registrado para auditoría.</p>}
    {query.approved && <p role="status" className="text-sm text-[#31523B]">Lista de acciones aprobada por Dirección.</p>}
    {matrix?.status !== "approved" || !source ? <section className={card}><h2 className="font-semibold">Dependencia pendiente</h2><p className="mt-2 text-sm">Primero debe aprobarse la FODA cuantitativa.</p></section> : !set ?
      <section className={card}><h2 className="font-semibold">Iniciar lista de acciones</h2><p className="my-3 text-sm">Se usará la matriz aprobada v{matrix.matrix_version} y la lista congelada de factores. La fuente quedará registrada.</p>
        {members.some((m) => m.id === actor.memberId && m.is_leader) && <form action={startStrategicActions}><button className={button}>Iniciar formulación</button></form>}</section> : <>
      <section className={card}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-[#192538]">1. Alcance de la estrategia</h2><span className="text-xs font-semibold uppercase text-[#5A626F]">{set.status === "approved" ? "Aprobado" : "Borrador"} · matriz v{matrix.matrix_version}</span></div>
        <p className="mt-2 text-sm text-[#5A626F]">La MDEP se calcula para una unidad de negocio, una oferta y un mercado definidos.</p>
        <form action={saveActionScope} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="set_id" value={set.id}/><input type="hidden" name="revision" value={set.revision}/>
          {([['business_unit','Unidad de negocio',set.business_unit],['offer','Oferta',set.offer],['customers','Clientes considerados',set.customers],['market','Mercado de referencia',set.market]] as const).map(([name,label,value]) =>
            <label key={name} className="text-sm font-medium text-[#192538]">{label}<input className={input} name={name} defaultValue={value} minLength={3} maxLength={400} required disabled={!canEdit}/></label>)}
          {canEdit && <button className={`${button} sm:col-span-2 sm:justify-self-start`}>Guardar alcance</button>}</form></section>
      <section className={card}><h2 className="text-lg font-semibold text-[#192538]">2. Acciones vinculadas al diagnóstico</h2>
        <p className="mt-2 text-sm text-[#5A626F]">La escala Pᵢ 1–5 mide importancia estratégica, no facilidad de ejecución. P1/P2 y las zonas de vulnerabilidad ayudan a justificarla; no se copian automáticamente.</p>
        <div className="mt-4 space-y-3">{actions.map((action, index) => <ActionCard key={action.id} item={action} index={index} setId={set.id} revision={set.revision}
          canEdit={Boolean(canEdit)} factors={source.data.factors} evidence={evidence} priority={priorities} zones={zones} factorById={factorById}/>)}</div>
        {canEdit && <details className="mt-5 rounded-xl border border-[#D6A871] bg-[#FBF5EB] p-4"><summary className="cursor-pointer font-semibold text-[#192538]">Añadir acción estratégica</summary>
          <ActionForm setId={set.id} revision={set.revision} factors={source.data.factors} evidence={evidence} priority={priorities} zones={zones}/></details>}
        {!actions.length && <p className="mt-4 text-sm text-[#5A626F]">Aún no se han registrado acciones. La MDEP mostrará «Cálculo pendiente» hasta aprobar la lista.</p>}</section>
      <section className={card}><h2 className="text-lg font-semibold text-[#192538]">3. Revisión y cierre</h2>
        <p className="mt-2 text-sm">{votes.length} participantes · mínimo 3, incluido el máximo director. {voteState.ready ? "Quórum alcanzado." : "Quórum pendiente."}</p>
        {votes.map((v) => <p key={v.id} className="mt-1 text-xs text-[#5A626F]">{members.find((m) => m.id === v.member_id)?.display_name ?? "Miembro"}: {v.decision} · {v.rationale}</p>)}
        {review && <p className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-sm">Consultor: {review.status === "approved" ? "aprobado" : "solicita cambios"} · {review.rationale}</p>}
        {canEdit && !votes.some((v) => v.member_id === actor.memberId) && <form action={voteStrategicActions} className="mt-4 space-y-2"><input type="hidden" name="set_id" value={set.id}/><input type="hidden" name="revision" value={set.revision}/>
          <label className="block text-sm">Mi decisión<select name="decision" className={input}><option value="validated">Valido acciones y prioridades</option><option value="doubt">Tengo una duda</option><option value="changes_requested">Solicito cambios</option></select></label>
          <label className="block text-sm">Fundamento<textarea name="rationale" className={input} minLength={10} maxLength={1000} required/></label><button className={button}>Registrar revisión</button></form>}
        {actor.role === "consultant" && set.status === "draft" && voteState.ready && !review && <form action={reviewStrategicActions} className="mt-4 space-y-2"><input type="hidden" name="set_id" value={set.id}/><input type="hidden" name="revision" value={set.revision}/>
          <p className="text-sm">Verifica enlaces con FODA, evidencia y fundamento de cada Pᵢ.</p><select name="decision" className={input}><option value="approved">Aprobar revisión metodológica</option><option value="changes_requested">Solicitar cambios</option></select>
          <textarea name="rationale" className={input} minLength={10} maxLength={1500} required placeholder="Observaciones y fundamento de la revisión"/><button className={button}>Registrar revisión del consultor</button></form>}
        {isDirector && voteState.ready && review?.status === "approved" && <form action={approveStrategicActions} className="mt-4"><input type="hidden" name="set_id" value={set.id}/><input type="hidden" name="revision" value={set.revision}/><button className={button}>Aprobar lista de acciones</button></form>}
        {set.status === "approved" && <Link href="/modulos/porter" className="mt-4 inline-block text-sm font-semibold text-[#192538] underline">Continuar a dirección competitiva →</Link>}</section>
    </>}
  </main></AppShell>;
}

function ActionCard({ item, index, setId, revision, canEdit, factors, evidence, priority, zones, factorById }: {
  item: StrategicAction; index: number; setId: string; revision: number; canEdit: boolean;
  factors: NonNullable<Awaited<ReturnType<typeof getMatrixSource>>>["data"]["factors"];
  evidence: Array<{ id: string; factor: string; statement: string }>;
  priority: Map<string,string>; zones: Map<string,string | undefined>;
  factorById: Map<string, NonNullable<Awaited<ReturnType<typeof getMatrixSource>>>["data"]["factors"][number]>;
}) {
  return <details className="rounded-xl border border-[#E6DFD6] p-4"><summary className="cursor-pointer font-semibold text-[#192538]">A{String(index+1).padStart(2,"0")} · {item.quadrant} · Pᵢ {item.priority}: {item.statement}</summary>
    <p className="mt-3 text-sm">Efecto esperado: {item.expected_effect}</p><p className="mt-1 text-sm">Fundamento de prioridad: {item.priority_rationale}</p>
    <p className="mt-1 text-xs text-[#5A626F]">Factores: {parse(item.factor_ids_json).map((id) => factorById.get(id)?.code ?? id).join(", ")} · versión {item.version}</p>
    {canEdit && <><ActionForm item={item} setId={setId} revision={revision} factors={factors} evidence={evidence} priority={priority} zones={zones}/>
      <form action={removeStrategicAction} className="mt-3"><input type="hidden" name="set_id" value={setId}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="action_id" value={item.id}/><button className="text-xs font-semibold text-[#933F34] underline">Retirar acción del borrador</button></form></>}
  </details>;
}

function ActionForm({ item, setId, revision, factors, evidence, priority, zones }: {
  item?: StrategicAction; setId: string; revision: number;
  factors: NonNullable<Awaited<ReturnType<typeof getMatrixSource>>>["data"]["factors"];
  evidence: Array<{ id: string; factor: string; statement: string }>;
  priority: Map<string,string>; zones: Map<string,string | undefined>;
}) {
  const selectedFactors = parse(item?.factor_ids_json ?? "[]"), selectedEvidence = parse(item?.evidence_ids_json ?? "[]");
  return <form action={saveStrategicAction} className="mt-4 space-y-3"><input type="hidden" name="set_id" value={setId}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="action_id" value={item?.id ?? ""}/>
    <label className="block text-sm font-medium">Origen FODA<select name="quadrant" defaultValue={item?.quadrant ?? "FO"} className={input}><option>FO</option><option>FA</option><option>DO</option><option>DA</option></select></label>
    <label className="block text-sm font-medium">Acción estratégica<textarea name="statement" defaultValue={item?.statement} className={input} minLength={12} maxLength={1000} required/></label>
    <label className="block text-sm font-medium">Efecto esperado<textarea name="expected_effect" defaultValue={item?.expected_effect} className={input} minLength={10} maxLength={1000} required/></label>
    <fieldset><legend className="text-sm font-semibold">Factores vinculados · elige al menos uno de cada eje del cuadrante</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{factors.map((f) => <label key={f.id} className="rounded-lg border p-2 text-xs"><input type="checkbox" name="factor_id" value={f.id} defaultChecked={selectedFactors.includes(f.id)} className="mr-2"/>{f.code} · {f.description}<span className="block text-[#5A626F]">{priority.get(f.id)}{zones.get(f.id) ? ` · ${zones.get(f.id)}` : ""}</span></label>)}</div></fieldset>
    <fieldset><legend className="text-sm font-semibold">Evidencia vinculada · selecciona fuentes de los factores elegidos</legend><div className="mt-2 max-h-52 space-y-1 overflow-auto">{evidence.map((e) => <label key={e.id} className="block text-xs"><input type="checkbox" name="evidence_id" value={e.id} defaultChecked={selectedEvidence.includes(e.id)} className="mr-2"/>{e.factor}: {e.statement}</label>)}</div></fieldset>
    <label className="block text-sm font-medium">Prioridad de acción Pᵢ (1–5)<select name="priority" defaultValue={item?.priority ?? ""} className={input} required><option value="">Selecciona</option>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
    <p className="text-xs text-[#5A626F]">1 secundaria · 2 directa a P2 o vínculo limitado con P1 · 3 directa a P1 · 4 varios P1 o vulnerabilidad crítica · 5 decisiva para varios P1 o vulnerabilidad muy crítica.</p>
    <label className="block text-sm font-medium">Justificación de Pᵢ<textarea name="priority_rationale" defaultValue={item?.priority_rationale ?? ""} className={input} minLength={10} maxLength={1000} required/></label>
    <button className={button}>{item ? "Guardar cambios" : "Agregar acción"}</button>
  </form>;
}
