import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, FileText } from "lucide-react";
import { changeFodaFactorStatus, saveFodaEvidence, saveFodaFactor } from "@/app/foda-actions";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { canRead, getActor } from "@/lib/authz";
import { axisLabels, duplicateFactorIds, type FodaAxis } from "@/lib/foda";
import { MAX_FODA_FACTORS_PER_AXIS } from "@/lib/methodology";
import { getDiagnosticInputs, isHighLevelMember } from "@/lib/sprint2";
import { getFodaEvidence, getFodaFactors, getFodaSet } from "@/lib/sprint3";
import { getCurrentCycle, getMembers, getOrganization } from "@/lib/workspace";

type Params = { axis?: string; edit?: string; factor?: string; evidence?: string; statusFactor?: string; error?: string; saved?: string };
const errors: Record<string, string> = {
  permission: "Tu rol no permite esta acción.", cycle: "Primero registra el ciclo estratégico.",
  invalid: "Completa la descripción, el área y la razón de clasificación dentro de los límites indicados.",
  evidence: "Cada factor necesita una evidencia cualitativa o cuantitativa, con referencia y periodo identificables.",
  stale: "Otro integrante modificó el FODA. Recarga la página y revisa la versión vigente antes de guardar.",
  frozen: "La lista está cerrada. Solo la dirección puede reabrirla desde FODA base.",
  missing: "No se encontró este factor o evidencia en el ciclo actual.",
};
const sourceTypes = [
  { value: "documento", label: "Documento" }, { value: "entrevista", label: "Entrevista o taller" },
  { value: "reporte_empresa", label: "Reporte de la empresa" }, { value: "otra", label: "Otra fuente" },
];

export async function FodaAnalysisPage({ side, searchParams }: { side: "internal" | "external"; searchParams: Promise<Params> }) {
  const path = side === "internal" ? "/modulos/analisis-interno" : "/modulos/analisis-externo";
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath(path));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const organization = await getOrganization();
  const cycle = organization ? await getCurrentCycle(organization.id) : null;
  if (!organization || !cycle) redirect("/organizacion");
  const [params, set, diagnostic, members] = await Promise.all([
    searchParams, getFodaSet(cycle.id), getDiagnosticInputs(cycle.id), getMembers(organization.id),
  ]);
  const factors = set ? await getFodaFactors(set.id) : [];
  const evidence = set ? await getFodaEvidence(set.id) : [];
  const axes: FodaAxis[] = side === "internal" ? ["F", "D"] : ["O", "A"];
  const axis = axes.includes(params.axis as FodaAxis) ? params.axis as FodaAxis : axes[0];
  const sideFactors = factors.filter((item) => axes.includes(item.axis));
  const selectedFactors = sideFactors.filter((item) => item.axis === axis);
  const editing = selectedFactors.find((item) => item.id === params.edit);
  const evidenceFactor = sideFactors.find((item) => item.id === params.factor);
  const editingEvidence = evidenceFactor ? evidence.find((item) => item.id === params.evidence && item.factor_id === evidenceFactor.id) : null;
  const statusFactor = sideFactors.find((item) => item.id === params.statusFactor);
  const actorMember = members.find((item) => item.id === actor.memberId);
  const canWrite = Boolean(await isHighLevelMember(organization.id, actor.memberId)) && Boolean(actorMember?.is_leader) && set?.status !== "frozen";
  const duplicates = duplicateFactorIds(factors);
  const active = sideFactors.filter((item) => item.status !== "discarded");
  const represented = axes.filter((item) => active.some((factor) => factor.axis === item)).length;
  const evidenceReady = represented === 2 && active.every((item) => item.status !== "needs_clarification" &&
    !duplicates.has(item.id) && evidence.some((entry) => entry.factor_id === item.id)) &&
    axes.every((item) => active.filter((factor) => factor.axis === item).length <= MAX_FODA_FACTORS_PER_AXIS);
  const progress = represented * 25 + Number(evidenceReady) * 25 + Number(set?.status === "frozen") * 25;
  const facts = diagnostic.filter((item) => item.classification === "dato" && item.source_detail);
  const error = params.error ? errors[params.error] : null;

  return <AppShell active={side === "internal" ? "analisis-interno" : "analisis-externo"}><div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#192538]"><ArrowLeft className="size-4" /> Volver al plan</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5A626F]">Módulo {side === "internal" ? "03" : "04"} · Diagnóstico</p><h1 className="mt-2 text-3xl font-semibold text-[#192538]">Análisis {side === "internal" ? "interno" : "externo"}</h1><p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#5A626F]">{side === "internal" ? "Identifica fortalezas y debilidades que la organización puede modificar. ¿Favorecen o perjudican los resultados?" : "Identifica oportunidades y amenazas del entorno que la organización no controla. ¿Qué efecto podrían tener?"} Describe un factor concreto y vincúlalo con una evidencia del cliente.</p></div><span className="text-2xl font-semibold text-[#192538]">{progress}%</span></div>
    <Progress value={progress} className="mt-6 h-2 bg-[#EEE8DF]" />
    <div className="mt-5 flex flex-wrap gap-2"><Link href="/modulos/analisis-interno" className={`rounded-lg px-4 py-2 text-sm font-medium ${side === "internal" ? "bg-[#192538] text-white" : "border border-[#E6DFD6] bg-white text-[#192538]"}`}>Análisis interno</Link><Link href="/modulos/analisis-externo" className={`rounded-lg px-4 py-2 text-sm font-medium ${side === "external" ? "bg-[#192538] text-white" : "border border-[#E6DFD6] bg-white text-[#192538]"}`}>Análisis externo</Link><Link href="/modulos/foda" className="rounded-lg border border-[#D6A871] bg-[#FBF5EB] px-4 py-2 text-sm font-medium text-[#192538]">Revisar FODA base</Link></div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {params.saved && <p role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-[#E6C99F] bg-[#FBF5EB] p-4 text-sm text-[#192538]"><CircleCheck className="size-4" /> Cambio guardado. Las validaciones anteriores de esta versión de trabajo deben renovarse.</p>}
    {set?.status === "frozen" && <p className="mt-5 rounded-xl border border-[#D6A871] bg-[#FBF5EB] p-4 text-sm text-[#192538]">Lista aprobada y congelada, versión {set.version}. Su contenido se conserva para las matrices del Sprint 4. Para corregirlo, la dirección debe reabrirla con un motivo registrado.</p>}

    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-6 lg:p-8"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5A626F]">Explicación → pregunta → evidencia → revisión</p><h2 className="mt-2 text-xl font-semibold text-[#192538]">{editing ? `Editar ${editing.code}` : `Registrar ${axisLabels[axis].toLowerCase()}`}</h2>
        <div className="mt-5 flex flex-wrap gap-2">{axes.map((item) => <Link key={item} href={`${path}?axis=${item}`} className={`rounded-lg px-4 py-2 text-sm ${axis === item ? "bg-[#D6A871] text-[#192538]" : "border border-[#E6DFD6] text-[#192538]"}`}>{axisLabels[item]} · {sideFactors.filter((factor) => factor.axis === item && factor.status !== "discarded").length}/{MAX_FODA_FACTORS_PER_AXIS}</Link>)}</div>
        <p className="mt-5 text-sm leading-6 text-[#5A626F]">{axis === "F" ? "¿Qué capacidad interna favorece los resultados y cómo se demuestra?" : axis === "D" ? "¿Qué limitación interna perjudica los resultados y cómo se demuestra?" : axis === "O" ? "¿Qué condición externa podría favorecer los resultados y qué fuente la respalda?" : "¿Qué condición externa podría perjudicar los resultados y qué fuente la respalda?"} El límite de 10 factores por categoría se comprueba al cerrar la lista; los hallazgos descartados se conservan.</p>
        {canWrite ? <form action={saveFodaFactor} className="mt-6 grid gap-5 sm:grid-cols-2"><input type="hidden" name="id" value={editing?.id ?? ""} /><input type="hidden" name="axis" value={axis} /><input type="hidden" name="expected_revision" value={set?.revision ?? 0} /><input type="hidden" name="expected_version" value={editing?.version ?? 0} />
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="factor-description">Factor específico</Label><Textarea id="factor-description" name="description" defaultValue={editing?.description ?? ""} required minLength={8} maxLength={500} className="min-h-24 bg-white text-base" placeholder="Una condición concreta, sin combinar varios factores" /></div>
          <div className="space-y-2"><Label htmlFor="factor-area">Área o proceso relacionado</Label><Input id="factor-area" name="area" defaultValue={editing?.area ?? ""} required minLength={2} maxLength={120} className="h-11 bg-white text-base" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="classification-reason">¿Por qué es {side === "internal" ? "interno y controlable" : "externo"} y {axis === "F" || axis === "O" ? "favorable" : "desfavorable"}?</Label><Textarea id="classification-reason" name="classification_reason" defaultValue={editing?.classification_reason ?? ""} required minLength={10} maxLength={1000} className="min-h-24 bg-white text-base" /></div>
          {!editing && <EvidenceFields facts={facts} idPrefix="initial" />}
          <div className="sm:col-span-2 flex flex-wrap gap-3"><Button type="submit">{editing ? "Guardar factor" : "Registrar factor y evidencia"}</Button>{editing && <Link href={`${path}?axis=${axis}`} className="rounded-lg border border-[#E6DFD6] px-4 py-2 text-sm">Cancelar edición</Link>}</div>
        </form> : <p className="mt-6 rounded-xl bg-[#FAF8F4] p-4 text-sm text-[#5A626F]">{set?.status === "frozen" ? "Lista cerrada: lectura y revisión histórica." : "Solo los líderes de opinión designados registran o corrigen factores."}</p>}
      </section>
      <aside className="rounded-2xl border border-[#E6DFD6] bg-white p-5"><h2 className="text-lg font-semibold text-[#192538]">Resumen de captura</h2><p className="mt-3 text-sm text-[#5A626F]">{represented}/2 categorías con factores activos · {active.length} factores en este análisis.</p><div className="mt-4 space-y-2">{axes.map((item) => <p key={item} className="flex justify-between border-b border-[#EEE8DF] py-2 text-sm"><span>{axisLabels[item]}</span><strong>{active.filter((factor) => factor.axis === item).length}/{MAX_FODA_FACTORS_PER_AXIS}</strong></p>)}</div><p className="mt-5 text-xs leading-5 text-[#5A626F]">Cada factor conserva código, fuente, periodo, responsable, versión y estado. Un antecedente del diagnóstico puede vincularse, pero un supuesto o una falta de información no cuenta como evidencia.</p><Link href="/diagnostico" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#192538]"><FileText className="size-4" /> Ver diagnóstico</Link></aside>
    </div>

    <section className="mt-8 rounded-2xl border border-[#E6DFD6] bg-white p-6 lg:p-8"><h2 className="text-xl font-semibold text-[#192538]">Factores y evidencias</h2><p className="mt-2 text-sm text-[#5A626F]">Revisa duplicados, origen y clasificación antes de enviar la lista a validación. Para reclasificar un factor, descarta el registro anterior con motivo y crea uno nuevo en la categoría correcta; los códigos históricos no se reutilizan.</p>
      {sideFactors.length === 0 ? <p className="mt-5 rounded-xl bg-[#FAF8F4] p-5 text-sm text-[#5A626F]">Aún no hay factores en este análisis.</p> : <div className="mt-5 space-y-4">{sideFactors.map((factor) => {
        const sources = evidence.filter((item) => item.factor_id === factor.id);
        const author = members.find((item) => item.auth_user_id === factor.created_by_user_id);
        return <article id={factor.id} key={factor.id} className="rounded-xl border border-[#E6DFD6] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5A626F]">{factor.code} · {axisLabels[factor.axis]} · {factor.status === "approved" ? "aprobado" : factor.status === "discarded" ? "descartado" : factor.status === "needs_clarification" ? "requiere aclaración" : "propuesto"} · v{factor.version}</p><h3 className="mt-2 text-lg font-semibold text-[#192538]">{factor.description}</h3></div>{duplicates.has(factor.id) && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">Posible duplicado</span>}</div><p className="mt-3 text-sm text-[#5A626F]">Área: {factor.area} · Aportó: {author?.display_name ?? "integrante"}</p><p className="mt-1 text-sm text-[#5A626F]">Clasificación: {factor.classification_reason}</p><div className="mt-4 space-y-2">{sources.map((source) => <div key={source.id} className="rounded-lg bg-[#FAF8F4] p-3 text-sm text-[#192538]"><strong>{source.evidence_type === "quantitative" ? "Cuantitativa" : "Cualitativa"}:</strong> {source.statement}<p className="mt-1 text-xs text-[#5A626F]">Fuente: {source.source_detail} · Periodo: {source.period} · v{source.version}{source.diagnostic_input_id ? " · vinculada al diagnóstico" : ""}</p>{canWrite && factor.status !== "discarded" && <Link href={`${path}?axis=${factor.axis}&factor=${factor.id}&evidence=${source.id}#evidencia`} className="mt-2 inline-block text-xs font-semibold text-[#192538]">Editar evidencia</Link>}</div>)}</div>{canWrite && <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium"><Link href={`${path}?axis=${factor.axis}&edit=${factor.id}`} className="text-[#192538]">Editar factor</Link>{factor.status !== "discarded" && <Link href={`${path}?axis=${factor.axis}&factor=${factor.id}#evidencia`} className="text-[#192538]">Añadir evidencia</Link>}<Link href={`${path}?axis=${factor.axis}&statusFactor=${factor.id}#estado`} className="text-[#192538]">Cambiar estado</Link></div>}</article>;
      })}</div>}
    </section>

    {canWrite && evidenceFactor && evidenceFactor.status !== "discarded" && <section id="evidencia" className="mt-8 rounded-2xl border border-[#E6C99F] bg-white p-6 lg:p-8"><h2 className="text-xl font-semibold text-[#192538]">{editingEvidence ? "Corregir" : "Añadir"} evidencia de {evidenceFactor.code}</h2><p className="mt-2 text-sm text-[#5A626F]">Describe el dato o testimonio, su fuente y su periodo. Una referencia indicada por el cliente no se presenta como verificación independiente.</p><form action={saveFodaEvidence} className="mt-5 grid gap-5 sm:grid-cols-2"><input type="hidden" name="id" value={editingEvidence?.id ?? ""} /><input type="hidden" name="factor_id" value={evidenceFactor.id} /><input type="hidden" name="axis" value={evidenceFactor.axis} /><input type="hidden" name="expected_revision" value={set?.revision ?? 0} /><input type="hidden" name="expected_version" value={editingEvidence?.version ?? 0} /><EvidenceFields facts={facts} values={editingEvidence ?? undefined} idPrefix="additional" /><div className="sm:col-span-2 flex gap-3"><Button type="submit">Guardar evidencia</Button><Link href={`${path}?axis=${evidenceFactor.axis}#${evidenceFactor.id}`} className="rounded-lg border border-[#E6DFD6] px-4 py-2 text-sm">Cancelar</Link></div></form></section>}
    {canWrite && statusFactor && <section id="estado" className="mt-8 rounded-2xl border border-[#E6C99F] bg-white p-6 lg:p-8"><h2 className="text-xl font-semibold text-[#192538]">Estado de {statusFactor.code}</h2><form action={changeFodaFactorStatus} className="mt-5 space-y-4"><input type="hidden" name="factor_id" value={statusFactor.id} /><input type="hidden" name="axis" value={statusFactor.axis} /><input type="hidden" name="expected_revision" value={set?.revision ?? 0} /><input type="hidden" name="expected_version" value={statusFactor.version} /><div className="space-y-2"><Label htmlFor="factor-status">Decisión de depuración</Label><NativeSelect id="factor-status" name="status" defaultValue={statusFactor.status === "approved" ? "proposed" : statusFactor.status} className="h-11 bg-white text-base"><NativeSelectOption value="proposed">Mantener como propuesto</NativeSelectOption><NativeSelectOption value="needs_clarification">Requiere aclaración</NativeSelectOption><NativeSelectOption value="discarded">Descartar del conjunto activo</NativeSelectOption></NativeSelect></div><div className="space-y-2"><Label htmlFor="factor-status-reason">Motivo de la decisión</Label><Textarea id="factor-status-reason" name="reason" required minLength={10} maxLength={1000} className="min-h-24 bg-white text-base" /></div><Button type="submit">Registrar estado</Button></form></section>}
  </div></AppShell>;
}

function EvidenceFields({ facts, values, idPrefix }: { facts: Awaited<ReturnType<typeof getDiagnosticInputs>>; idPrefix: string; values?: { evidence_type: string; statement: string; source_type: string; source_detail: string; period: string; diagnostic_input_id: string | null } }) {
  return <><div className="space-y-2"><Label htmlFor={`${idPrefix}-evidence-type`}>Tipo de evidencia</Label><NativeSelect id={`${idPrefix}-evidence-type`} name="evidence_type" defaultValue={values?.evidence_type ?? "qualitative"} className="h-11 w-full bg-white text-base"><NativeSelectOption value="qualitative">Cualitativa</NativeSelectOption><NativeSelectOption value="quantitative">Cuantitativa</NativeSelectOption></NativeSelect></div><div className="space-y-2"><Label htmlFor={`${idPrefix}-evidence-source-type`}>Origen</Label><NativeSelect id={`${idPrefix}-evidence-source-type`} name="source_type" defaultValue={values?.source_type ?? "documento"} className="h-11 w-full bg-white text-base">{sourceTypes.map((item) => <NativeSelectOption key={item.value} value={item.value}>{item.label}</NativeSelectOption>)}</NativeSelect></div><div className="space-y-2 sm:col-span-2"><Label htmlFor={`${idPrefix}-evidence-statement`}>Evidencia concreta</Label><Textarea id={`${idPrefix}-evidence-statement`} name="evidence_statement" defaultValue={values?.statement ?? ""} required minLength={8} maxLength={1500} className="min-h-24 bg-white text-base" placeholder="Dato, observación o testimonio vinculado al factor" /></div><div className="space-y-2"><Label htmlFor={`${idPrefix}-evidence-detail`}>Referencia de la fuente</Label><Input id={`${idPrefix}-evidence-detail`} name="source_detail" defaultValue={values?.source_detail ?? ""} required minLength={3} maxLength={500} className="h-11 bg-white text-base" placeholder="Informe, entrevista, persona o documento" /></div><div className="space-y-2"><Label htmlFor={`${idPrefix}-evidence-period`}>Periodo de la evidencia</Label><Input id={`${idPrefix}-evidence-period`} name="period" defaultValue={values?.period ?? ""} required minLength={2} maxLength={120} className="h-11 bg-white text-base" placeholder="Ej. 2025 o primer semestre 2026" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor={`${idPrefix}-diagnostic-link`}>Vincular antecedente del diagnóstico (opcional)</Label><NativeSelect id={`${idPrefix}-diagnostic-link`} name="diagnostic_input_id" defaultValue={values?.diagnostic_input_id ?? ""} className="h-11 w-full bg-white text-base"><NativeSelectOption value="">Sin vínculo a un antecedente existente</NativeSelectOption>{facts.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.area}: {item.statement.slice(0, 95)}</NativeSelectOption>)}</NativeSelect><p className="text-xs text-[#5A626F]">Solo aparecen datos aportados con fuente identificada; los supuestos y [FALTA] siguen pendientes.</p></div></>;
}
