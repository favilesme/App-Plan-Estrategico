import Link from "next/link";
import { actionPriorityConflict } from "@/lib/action-priority";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { approveMdep, reviewMdep, saveFocusDetail, saveMdepAffinity, saveMdepCondition,
  saveMdepContext, saveMdepCriterion, saveMdepDirectionBrief, startMdep, suggestMdepAffinities, voteMdep } from "@/app/strategy-actions";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { canRead, getActor } from "@/lib/authz";
import { matrixVoteState } from "@/lib/foda-matrix";
import { parseAffinitySuggestions, readableEvidenceRationale } from "@/lib/mdep-affinity-draft";
import { CRITERIA, DIRECTIONS, DIRECTION_LABELS, directionResult, displayScore, mdepRecommendation,
  viabilityScore, type Direction } from "@/lib/mdep";
import { getFodaSet } from "@/lib/sprint3";
import { getMatrixSource, getMatrixVersions } from "@/lib/sprint4";
import { getActionSet, getAffinities, getAffinityDrafts, getConditions, getCriteria, getDirectionBriefs, getMdep, getMdepVotes,
  getStrategicActions, latestGate, type Affinity, type Condition, type Criterion, type DirectionBrief, type MdepAssessment,
  type StrategicAction } from "@/lib/sprint5";
import { getCurrentCycle, getMembers, getOrganization } from "@/lib/workspace";

const input = "mt-1 w-full rounded-lg border border-[#C9C5BF] bg-white px-3 py-2 text-sm text-[#192538]";
const button = "rounded-lg bg-[#192538] px-4 py-2 text-sm font-semibold text-white hover:bg-[#344052]";
const card = "rounded-2xl border border-[#E6DFD6] bg-white p-5";
const parse = (raw: string) => { try { return JSON.parse(raw) as string[]; } catch { return []; } };
const porterErrors: Record<string, string> = {
  ai: "No se pudo generar el borrador de IA. Las afinidades ya guardadas permanecen registradas; puedes revisar la causa e intentarlo de nuevo.",
  ai_service: "El servicio de IA no respondió correctamente. Las afinidades guardadas permanecen registradas; inténtalo de nuevo más tarde.",
  ai_timeout: "La generación de IA tardó demasiado. Las afinidades guardadas permanecen registradas; inténtalo de nuevo.",
  ai_response: "La IA no devolvió un borrador completo y verificable. Las afinidades guardadas permanecen registradas; inténtalo de nuevo.",
  ai_unavailable: "La generación de IA no está disponible en este momento. Las afinidades guardadas permanecen registradas.",
  affinity: "No se guardó la afinidad. Indica una nota de 0 a 3, una justificación de al menos 10 caracteres y al menos una evidencia de la acción.",
  stale: "La valoración cambió en otra sesión. Actualiza la página y revisa los datos antes de guardar.",
};

export async function MdepPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; approved?: string; suggested?: string; action?: string }> }) {
  const query = await searchParams;
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/modulos/porter"));
  if (!canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const org = await getOrganization();
  const cycle = org && await getCurrentCycle(org.id);
  const foda = cycle && await getFodaSet(cycle.id);
  const matrix = foda && (await getMatrixVersions(foda.id)).find((m) => m.set_version === foda.version);
  const source = matrix && await getMatrixSource(matrix.source_snapshot_id);
  const set = matrix && await getActionSet(matrix.id);
  const mdep = set && await getMdep(set.id);
  const [actions, affinities, drafts, criteria, conditions, briefs, votes, members] = await Promise.all([
    set ? getStrategicActions(set.id) : Promise.resolve([]), mdep ? getAffinities(mdep.id) : Promise.resolve([]),
    mdep ? getAffinityDrafts(mdep.id) : Promise.resolve([]),
    mdep ? getCriteria(mdep.id) : Promise.resolve([]), mdep ? getConditions(mdep.id) : Promise.resolve([]),
    mdep ? getDirectionBriefs(mdep.id) : Promise.resolve([]),
    mdep ? getMdepVotes(mdep.id, mdep.revision) : Promise.resolve([]), org ? getMembers(org.id) : Promise.resolve([]),
  ]);
  const priorityConflicts = actions.filter(actionPriorityConflict);
  const evidenceById = new Map(source?.data.factors.flatMap((factor) =>
    factor.evidence.map((item) => [item.id, {
      factorCode: factor.code, statement: item.statement,
      sourceDetail: item.source_detail, period: item.period,
    }] as const)) ?? []);
  const results = DIRECTIONS.map((d) => directionResult(actions.map((a) => ({ id: a.id, priority: a.priority })),
    affinities.map((a) => ({ action_id: a.action_id, direction: a.direction, score: a.score })),
    criteria.filter((c) => c.scope === "general").map((c) => ({ direction: c.direction, criterion_key: c.criterion_key, score: c.score })),
    conditions.map((c) => ({ direction: c.direction, status: c.status })), d));
  const recommendation = mdepRecommendation(results);
  const canEdit = mdep?.status === "draft" && members.some((m) => m.id === actor.memberId && m.status === "active" && m.is_leader);
  const isDirector = canEdit && members.some((m) => m.id === actor.memberId && m.is_director);
  const voteState = matrixVoteState(votes.map((v) => ({ ...v, matrix_id: v.assessment_id, matrix_revision: v.assessment_revision,
    decision: "validated" as const })), members);
  const review = cycle && mdep ? await latestGate(cycle.id, "porter.mdep", `${mdep.id}:r${mdep.revision}`) : null;
  const allComplete = Boolean(mdep && mdep.competitive_context.length >= 20 && results.every((r) => r.score !== null &&
    conditions.some((c) => c.direction === r.direction) && briefs.some((b) => b.direction === r.direction)));
  const segmentCriteria = criteria.filter((c) => c.scope === "segment");
  const segmentScores = { costes: viabilityScore(segmentCriteria, "costes"), diferenciacion: viabilityScore(segmentCriteria, "diferenciacion") };
  return <AppShell active="porter"><main className="mx-auto max-w-6xl space-y-6 px-5 py-8 lg:px-9">
    <Link href="/modulos/formulacion" className="text-sm font-semibold text-[#192538] underline">← Acciones estratégicas</Link>
    <header><p className="text-xs font-semibold uppercase tracking-widest text-[#5A626F]">Sprint 5 · MDEP piloto 1.1</p>
      <h1 className="mt-2 font-serif text-3xl text-[#192538]">Dirección competitiva</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5A626F]">Compara costes, diferenciación y enfoque con la metodología experimental de Anima Praxis. Las categorías competitivas vienen de Porter; las escalas, el 60/40 y los umbrales son del piloto. Toda recomendación requiere evidencia y decisión del cliente.</p></header>
    {query.error && <p role="alert" className="rounded-lg bg-[#FBF0EA] p-3 text-sm text-[#7E3527]">{porterErrors[query.error] ?? `No se completó la operación (${query.error}). Revisa la información y la versión de trabajo.`}</p>}
    {query.saved && <p role="status" className="rounded-lg bg-[#EAF3EC] p-3 text-sm text-[#31523B]">{actions.some((a) => a.id === query.saved) ? "Afinidad guardada. La valoración permanece pendiente de la revisión final MDEP." : "Valoración guardada con trazabilidad."}</p>}
    {query.suggested && <p role="status" className="rounded-lg bg-[#FBF5EB] p-3 text-sm text-[#192538]">Borrador de IA generado para la acción indicada. Revisa y guarda cada afinidad para convertirla en valoración del equipo.</p>}
    {query.approved && <p role="status" className="text-sm text-[#31523B]">Dirección estratégica aprobada por Dirección.</p>}
    {!set || set.status !== "approved" ? <section className={card}><h2 className="font-semibold">Acciones pendientes</h2><p className="mt-2 text-sm">La lista de acciones y prioridades debe estar aprobada antes de calcular la MDEP.</p><Link href="/modulos/formulacion" className="mt-3 inline-block text-sm underline">Abrir formulación</Link></section> : !mdep ?
      <section className={card}><h2 className="font-semibold">Iniciar MDEP</h2><p className="my-3 text-sm">Unidad: {set.business_unit} · Oferta: {set.offer} · Mercado: {set.market}. Se usarán las {actions.length} acciones aprobadas.</p>
        {priorityConflicts.length > 0 ? <p role="alert" className="rounded-lg bg-[#FBF5EB] p-3 text-sm">Hay una prioridad escrita que contradice el valor Pᵢ guardado. <Link href="/modulos/formulacion" className="font-semibold underline">Revisar acciones</Link> antes de calcular.</p> : members.some((m) => m.id === actor.memberId && m.is_leader) && <form action={startMdep}><button className={button}>Iniciar comparación</button></form>}</section> : <>
      <section className={card}><h2 className="text-lg font-semibold text-[#192538]">1. Contexto competitivo</h2>
        <p className="mt-2 text-sm">Registra solo datos disponibles sobre rivalidad, nuevos entrantes, clientes, proveedores y sustitutos. Señala [FALTA] cuando no haya información suficiente; una objeción material debe quedar visible en la deliberación.</p>
        <form action={saveMdepContext} className="mt-3 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/>
          <textarea name="competitive_context" defaultValue={mdep.competitive_context} className={input} rows={4} minLength={20} maxLength={3000} required disabled={!canEdit}/>
          {canEdit && <button className={button}>Guardar contexto</button>}</form></section>
      <section className={card}><h2 className="text-lg font-semibold text-[#192538]">2. Afinidad de cada acción</h2>
        <p className="mt-2 text-sm text-[#5A626F]">0 sin relación · 1 indirecta · 2 significativa · 3 directa. La nota no mide viabilidad. Toda acción aprobada entra en el denominador, incluso con afinidad 0.</p>
        <div className="mt-4 space-y-3">{actions.map((action, index) => <details key={action.id} id={`accion-${action.id}`} open={query.suggested === action.id || query.saved === action.id || query.action === action.id} className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold text-[#192538]">A{String(index+1).padStart(2,"0")} · Pᵢ {action.priority} · {action.statement}</summary>
          <p className="mt-2 text-xs">{action.quadrant} · {action.expected_effect} · Factores {parse(action.factor_ids_json).length} · Evidencias {parse(action.evidence_ids_json).length}</p>
          {canEdit && <form action={suggestMdepAffinities} className="mt-3"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/><input type="hidden" name="action_id" value={action.id}/><button className={button}>{drafts.some((d) => d.action_id === action.id) ? "Regenerar borrador de IA" : "Generar borrador de afinidades con IA"}</button><p className="mt-1 text-xs text-[#5A626F]">El borrador no modifica las afinidades guardadas.</p></form>}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">{DIRECTIONS.map((direction) => <AffinityForm key={direction} mdep={mdep} action={action} direction={direction}
            current={affinities.find((a) => a.action_id === action.id && a.direction === direction)}
            draft={parseAffinitySuggestions(drafts.find((d) => d.action_id === action.id)?.suggestions_json ?? "[]").find((s) => s.direction === direction)}
            evidenceById={evidenceById} canEdit={Boolean(canEdit)}/>)}</div></details>)}</div></section>
      <section className={card}><h2 className="text-lg font-semibold text-[#192538]">3. Viabilidad competitiva</h2>
        <p className="mt-2 text-sm text-[#5A626F]">Cada criterio se valora de 0 a 4 con fuente y fundamento. [FALTA] no se registra como cero.</p>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">{DIRECTIONS.map((direction) => <div key={direction} className="rounded-xl border p-4"><h3 className="font-semibold">{DIRECTION_LABELS[direction]}</h3>
          <div className="mt-3 space-y-2">{CRITERIA[direction].map((criterion) => <CriterionForm key={criterion.key} mdep={mdep} direction={direction} criterion={criterion}
            current={criteria.find((c) => c.scope === "general" && c.direction === direction && c.criterion_key === criterion.key)} canEdit={Boolean(canEdit)}/>)}</div>
          <ConditionForm mdep={mdep} direction={direction} current={conditions.find((c) => c.direction === direction)} canEdit={Boolean(canEdit)}/>
        </div>)}</div></section>
      <section className={card}><h2 className="text-lg font-semibold text-[#192538]">4. Matriz de decisión estratégica</h2>
        <p className="mt-2 text-sm">Cálculo: 60 % afinidad FODA + 40 % viabilidad. Se conserva la precisión interna y se muestra un decimal. Las tres afinidades se calculan de forma independiente.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left text-sm"><thead><tr className="border-b text-[#5A626F]"><th className="p-2">Dirección</th><th className="p-2">Afinidad</th><th className="p-2">Viabilidad</th><th className="p-2">MDEP</th><th className="p-2">Condición</th></tr></thead>
          <tbody>{results.map((r) => <tr key={r.direction} className="border-b"><td className="p-2 font-semibold">{DIRECTION_LABELS[r.direction]}</td><td className="p-2">{displayScore(r.affinity)}</td><td className="p-2">{displayScore(r.viability)}</td><td className="p-2">{displayScore(r.score)}</td><td className="p-2">{r.status}</td></tr>)}</tbody></table></div>
        <p className="mt-4 rounded-lg bg-[#FBF5EB] p-3 text-sm font-semibold">Lectura metodológica: {recommendation.label}{recommendation.direction ? ` · ${DIRECTION_LABELS[recommendation.direction]}` : ""}. Es una hipótesis para validar, no una elección automática.</p>
        <p className="mt-2 text-xs text-[#5A626F]">Ventaja en costes requiere menor coste estructural y valor aceptable; diferenciación requiere valor reconocido por clientes; enfoque requiere segmento delimitado, necesidades distintas y actividades adaptadas. Una condición pendiente bloquea la recomendación aunque la cifra sea alta.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">{DIRECTIONS.map((direction) => <DirectionBriefForm key={direction} mdep={mdep} direction={direction}
          current={briefs.find((b) => b.direction === direction)} actions={actions} affinities={affinities}
          factorMap={new Map(source?.data.factors.map((f) => [f.id, { code: f.code, axis: f.axis, description: f.description }]) ?? [])}
          canEdit={Boolean(canEdit)}/>)}</div></section>
      <section className={card}><h2 className="text-lg font-semibold text-[#192538]">5. Si se considera enfoque</h2>
        <p className="mt-2 text-sm">Compara costes y diferenciación **dentro del segmento**. Los puntajes generales de esas direcciones no se reutilizan.</p>
        <p className="mt-2 text-sm">Viabilidad específica: costes {displayScore(segmentScores.costes)} · diferenciación {displayScore(segmentScores.diferenciacion)}. Son apoyos para deliberar, no una selección automática.</p>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">{(["costes", "diferenciacion"] as const).map((direction) => <details key={direction} className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">En el segmento: {DIRECTION_LABELS[direction]}</summary>
          {CRITERIA[direction].map((criterion) => <CriterionForm key={criterion.key} mdep={mdep} direction={direction} criterion={criterion}
            current={criteria.find((c) => c.scope === "segment" && c.direction === direction && c.criterion_key === criterion.key)} canEdit={Boolean(canEdit)} scope="segment"/>)}</details>)}</div>
        <form action={saveFocusDetail} className="mt-4 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/>
          <label className="block text-sm">Segmento delimitado<textarea name="segment" defaultValue={mdep.focus_segment ?? ""} className={input} minLength={10} maxLength={800} required disabled={!canEdit}/></label>
          <label className="block text-sm">Ventaja considerada<select name="advantage" defaultValue={mdep.focus_advantage ?? ""} className={input} disabled={!canEdit}><option value="">Pendiente</option><option value="costes">Costes en el segmento</option><option value="diferenciacion">Diferenciación en el segmento</option></select></label>
          <label className="block text-sm">Necesidades atendidas, actividades adaptadas y exclusiones<textarea name="exclusions" defaultValue={mdep.focus_exclusions ?? ""} className={input} minLength={10} maxLength={800} required disabled={!canEdit}/></label>
          {canEdit && <button className={button}>Guardar enfoque</button>}</form></section>
      <section className={card}><h2 className="text-lg font-semibold text-[#192538]">6. Deliberación, revisión y decisión</h2>
        <p className="mt-2 text-sm">{votes.length} participaciones · mínimo 3, incluido el máximo director. {voteState.ready ? "Quórum alcanzado." : "Quórum pendiente."}</p>
        {votes.map((v) => <p key={v.id} className="mt-1 text-xs text-[#5A626F]">{members.find((m) => m.id === v.member_id)?.display_name ?? "Miembro"}: {DIRECTION_LABELS[v.direction]} · {v.rationale}</p>)}
        {review && <p className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-sm">Consultor: {review.status} · {review.rationale}</p>}
        {canEdit && allComplete && !votes.some((v) => v.member_id === actor.memberId) && <form action={voteMdep} className="mt-4 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/>
          <label className="block text-sm">Dirección que propones<select name="direction" className={input}>{results.filter((r) => r.eligible).map((r) => <option key={r.direction} value={r.direction}>{DIRECTION_LABELS[r.direction]}</option>)}</select></label>
          <label className="block text-sm">Justificación<textarea name="rationale" className={input} minLength={10} maxLength={1500} required/></label><button className={button}>Registrar deliberación</button></form>}
        {actor.role === "consultant" && allComplete && voteState.ready && !review && <form action={reviewMdep} className="mt-4 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/>
          <p className="text-sm">Revisa prioridades, afinidades, fuentes, contradicciones y condiciones obligatorias.</p><select name="decision" className={input}><option value="approved">Aprobar revisión</option><option value="changes_requested">Solicitar cambios</option></select>
          <textarea name="rationale" className={input} minLength={10} maxLength={1500} required placeholder="Fundamento y observaciones"/><button className={button}>Registrar revisión metodológica</button></form>}
        {isDirector && review?.status === "approved" && voteState.ready && <form action={approveMdep} className="mt-4 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/>
          <label className="block text-sm">Dirección elegida<select name="direction" className={input}>{results.filter((r) => r.eligible).map((r) => <option key={r.direction} value={r.direction}>{DIRECTION_LABELS[r.direction]}</option>)}</select></label>
          <label className="block text-sm">Justificación, elecciones y actividades necesarias<textarea name="rationale" className={input} minLength={20} maxLength={2000} required/></label><button className={button}>Aprobar dirección estratégica</button></form>}
        {mdep.status === "approved" && <p className="mt-4 rounded-lg bg-[#EAF3EC] p-3 text-sm font-semibold">Decisión del cliente: {DIRECTION_LABELS[mdep.choice_direction!]} · {mdep.choice_rationale}</p>}
      </section>
    </>}
  </main></AppShell>;
}

function AffinityForm({ mdep, action, direction, current, draft, evidenceById, canEdit }: { mdep: MdepAssessment; action: StrategicAction;
  direction: Direction; current?: Affinity; draft?: { score: number; rationale: string; evidence_ids: string[] };
  evidenceById: ReadonlyMap<string, { factorCode: string; statement: string; sourceDetail: string; period: string }>;
  canEdit: boolean }) {
  const evidence = parse(action.evidence_ids_json), selected = parse(current?.evidence_ids_json ?? "[]");
  const editor = canEdit && <form key={JSON.stringify([current?.version, draft])} action={saveMdepAffinity} className="mt-2 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/><input type="hidden" name="action_id" value={action.id}/><input type="hidden" name="direction" value={direction}/>
      <select name="score" className={input} defaultValue={current?.score ?? draft?.score ?? ""} required><option value="">[FALTA]</option>{[0,1,2,3].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      <textarea name="rationale" className={input} defaultValue={readableEvidenceRationale(current?.rationale ?? draft?.rationale ?? "", evidenceById)} minLength={10} maxLength={1000} required placeholder="Relación de la acción con esta dirección"/>
      <fieldset><legend className="font-semibold">Evidencias de la acción</legend><div className="mt-1 space-y-2">{evidence.map((id) => {
        const item = evidenceById.get(id);
        return <label key={id} className="flex items-start gap-2 rounded-lg border border-[#E6DFD6] bg-white p-2 text-xs leading-5">
          <input type="checkbox" name="evidence_id" value={id} defaultChecked={selected.includes(id) || (!current && Boolean(draft?.evidence_ids.includes(id)))} className="mt-1 shrink-0"/>
          <span className="min-w-0 break-words">{item ? <><span className="font-semibold">{item.factorCode} · {item.statement}</span><span className="block text-[#5A626F]">Fuente: {item.sourceDetail} · Período: {item.period}</span></> : <span className="text-[#933F34]">Evidencia no disponible en la matriz aprobada · referencia {id}</span>}</span>
        </label>;
      })}</div></fieldset>
      <button className={button}>{current ? "Guardar cambios" : "Guardar afinidad"}</button></form>;
  return <div className="rounded-lg bg-[#FAF8F4] p-3 text-xs"><h4 className="font-semibold">{DIRECTION_LABELS[direction]} · {current ? `Guardada: ${current.score}/3` : "[FALTA]"}</h4>
    {current ? <><p className="mt-1 rounded bg-[#EAF3EC] p-2 text-[#31523B]">Valoración registrada · {mdep.status === "approved" ? "incluida en la MDEP aprobada" : "pendiente de revisión final MDEP"}.</p><p className="mt-2">{readableEvidenceRationale(current.rationale, evidenceById)}</p><p className="mt-1 text-[#5A626F]">Evidencias vinculadas: {selected.length}</p></> :
      draft && <p className="mt-2 rounded bg-[#FBF5EB] p-2">Borrador IA: {draft.score} · {readableEvidenceRationale(draft.rationale, evidenceById)}</p>}
    {current && canEdit ? <details className="mt-3 rounded-lg border border-[#C9C5BF] bg-white p-2"><summary className="cursor-pointer font-semibold text-[#192538]">Editar afinidad</summary>{editor}</details> : editor}
  </div>;
}

function CriterionForm({ mdep, direction, criterion, current, canEdit, scope="general" }: { mdep: MdepAssessment; direction: Direction;
  criterion: { key: string; label: string; why: string }; current?: Criterion; canEdit: boolean; scope?: "general" | "segment" }) {
  return <details className="rounded-lg border p-2 text-xs"><summary className="cursor-pointer font-semibold">{criterion.label}: {current?.score ?? "[FALTA]"}</summary><p className="mt-1 text-[#5A626F]">{criterion.why}</p>
    {current && <p className="mt-1">{current.rationale} · Fuente: {current.source_detail}</p>}
    {canEdit && <form action={saveMdepCriterion} className="mt-2 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/><input type="hidden" name="direction" value={direction}/><input type="hidden" name="criterion_key" value={criterion.key}/><input type="hidden" name="scope" value={scope}/>
      <select name="score" className={input} defaultValue={current?.score ?? ""} required><option value="">[FALTA]</option>{[0,1,2,3,4].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      <textarea name="rationale" className={input} defaultValue={current?.rationale ?? ""} minLength={10} maxLength={1000} required placeholder="Por qué merece esta nota"/>
      <input name="source_detail" className={input} defaultValue={current?.source_detail ?? ""} minLength={8} maxLength={1000} required placeholder="Fuente, fecha y grado de verificación"/>
      <button className={button}>Guardar criterio</button></form>}</details>;
}

function ConditionForm({ mdep, direction, current, canEdit }: { mdep: MdepAssessment; direction: Direction; current?: Condition; canEdit: boolean }) {
  return <details className="mt-3 rounded-lg border border-[#D6A871] p-3 text-xs"><summary className="cursor-pointer font-semibold">Condición obligatoria: {current?.status ?? "[FALTA]"}</summary>
    <p className="mt-1">{direction === "costes" ? "Menor coste estructural relativo y valor aceptable." : direction === "diferenciacion" ? "El cliente reconoce y valora la diferencia." : "Segmento definido, necesidades distintas y actividades adaptadas."}</p>
    {current && <p className="mt-1">{current.rationale} · {current.source_detail}</p>}
    {canEdit && <form action={saveMdepCondition} className="mt-2 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/><input type="hidden" name="direction" value={direction}/>
      <select name="status" className={input} defaultValue={current?.status ?? "pending"}><option value="pending">Pendiente de evidencia</option><option value="met">Cumplida</option><option value="unmet">Incumplida</option></select>
      <textarea name="rationale" className={input} defaultValue={current?.rationale ?? ""} minLength={10} maxLength={1000} required placeholder="Fundamento"/>
      <input name="source_detail" className={input} defaultValue={current?.source_detail ?? ""} minLength={8} maxLength={1000} required placeholder="Fuente, fecha y verificación"/>
      <button className={button}>Guardar condición</button></form>}</details>;
}

function DirectionBriefForm({ mdep, direction, current, actions, affinities, factorMap, canEdit }: {
  mdep: MdepAssessment; direction: Direction; current?: DirectionBrief; actions: StrategicAction[]; affinities: Affinity[];
  factorMap: Map<string, { code: string; axis: string; description: string }>; canEdit: boolean;
}) {
  const related = actions.map((action) => ({ action, affinity: affinities.find((a) => a.action_id === action.id && a.direction === direction) }))
    .filter((x) => x.affinity && x.affinity.score > 0);
  const factorIds = [...new Set(related.flatMap(({ action }) => parse(action.factor_ids_json)))];
  return <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">{DIRECTION_LABELS[direction]} · {current ? "ficha registrada" : "ficha pendiente"}</summary>
    <p className="mt-2 text-xs text-[#5A626F]">Acciones que aportan: {related.length ? related.map(({ action }) => action.statement).join("; ") : "[FALTA]"}</p>
    <div className="mt-2 space-y-1 text-xs">{["F","D","O","A"].map((axis) => <p key={axis}><strong>{axis}:</strong> {factorIds.map((id) => factorMap.get(id)).filter((f) => f?.axis === axis).map((f) => `${f?.code} ${f?.description}`).join("; ") || "[FALTA]"}</p>)}</div>
    <p className="mt-2 text-xs">Evidencias vinculadas: {related.flatMap(({ affinity }) => parse(affinity?.evidence_ids_json ?? "[]")).length}</p>
    {current && <div className="mt-2 space-y-1 text-xs"><p><strong>Ventajas:</strong> {current.advantages}</p><p><strong>Riesgos:</strong> {current.risks}</p><p><strong>Capacidades:</strong> {current.required_capabilities}</p><p><strong>Operación:</strong> {current.operational_implications}</p><p><strong>Coherencia:</strong> {current.market_coherence}</p></div>}
    {canEdit && <form action={saveMdepDirectionBrief} className="mt-3 space-y-2"><input type="hidden" name="assessment_id" value={mdep.id}/><input type="hidden" name="revision" value={mdep.revision}/><input type="hidden" name="direction" value={direction}/>
      {([['advantages','Ventajas'],['risks','Riesgos'],['required_capabilities','Capacidades necesarias'],['operational_implications','Implicaciones operativas'],['market_coherence','Coherencia entre ventaja, mercado y actividades']] as const).map(([name,label]) =>
        <label key={name} className="block text-xs">{label}<textarea name={name} defaultValue={current?.[name] ?? ""} className={input} minLength={10} maxLength={1500} required/></label>)}
      <button className={button}>Guardar ficha</button></form>}
  </details>;
}
