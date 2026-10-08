import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, LockKeyhole } from "lucide-react";
import { freezeFodaSet, reopenFodaSet, reviewFodaDoubt, validateFodaSet } from "@/app/foda-actions";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { canRead, getActor } from "@/lib/authz";
import { axisLabels, factorIssues, latestValidations, quorum, FODA_AXES } from "@/lib/foda";
import { MAX_FODA_FACTORS_PER_AXIS, MIN_VALIDATION_QUORUM } from "@/lib/methodology";
import { diagnosticSubject, getDiagnosticInputs, latestApproval } from "@/lib/sprint2";
import { getConsultantFodaReview, getFodaEvidence, getFodaFactors, getFodaSet, getFodaSnapshots, getFodaValidations } from "@/lib/sprint3";
import { getCurrentCycle, getMembers, getOrganization } from "@/lib/workspace";

type Params = { error?: string; validated?: string; reviewed?: string; frozen?: string; reopened?: string };
const errors: Record<string, string> = {
  permission: "Tu rol no permite esta acción.", cycle: "Primero registra el ciclo estratégico.",
  invalid: "Registra una decisión y un fundamento de al menos 10 caracteres.",
  stale: "El conjunto cambió mientras trabajabas. Recarga y revisa la versión vigente.",
  frozen: "La lista ya está congelada; solo la dirección puede reabrirla.",
  incomplete: "Resuelve los pendientes de factores, evidencias, duplicados y límites antes de validar.",
  quorum: "Falta la participación mínima de líderes, incluido el director, o hay una solicitud de cambios.",
  doubt: "La duda requiere aprobación metodológica del consultor antes del cierre.",
  review_locked: "El consultor ya revisó esta versión. Para cambiar votos, primero debe corregirse el conjunto y abrir una nueva revisión.",
  review_unavailable: "La revisión excepcional solo se habilita con quórum y una duda documentada vigente.",
  diagnostic: "El diagnóstico debe contar con una revisión vigente del consultor antes de cerrar la lista FODA.",
};

export async function FodaReviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const path = "/modulos/foda";
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath(path));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const organization = await getOrganization();
  const cycle = organization ? await getCurrentCycle(organization.id) : null;
  if (!organization || !cycle) redirect("/organizacion");
  const [params, set, members] = await Promise.all([searchParams, getFodaSet(cycle.id), getMembers(organization.id)]);
  const factors = set ? await getFodaFactors(set.id) : [];
  const evidence = set ? await getFodaEvidence(set.id) : [];
  const validations = set ? latestValidations(await getFodaValidations(set)) : [];
  const snapshots = set ? await getFodaSnapshots(set.id) : [];
  const review = set ? await getConsultantFodaReview(set) : null;
  const diagnostic = await getDiagnosticInputs(cycle.id);
  const diagnosticKey = diagnosticSubject(diagnostic);
  const diagnosticApproved = (await latestApproval(cycle.id, "diagnostic.review", diagnosticKey))?.status === "approved";
  const currentSnapshot = set?.status === "frozen" ? snapshots.find((item) => item.version === set.version) : null;
  const frozenSource = currentSnapshot
    ? JSON.parse(currentSnapshot.snapshot_json) as { diagnosticSubject?: string }
    : null;
  const diagnosticChangedSinceFreeze = Boolean(frozenSource && frozenSource.diagnosticSubject !== diagnosticKey);
  const issues = factorIssues(factors, evidence);
  const q = quorum(validations, members);
  const actorMember = members.find((item) => item.id === actor.memberId);
  const canValidate = Boolean(actorMember?.is_leader && actorMember.status === "active" &&
    ["owner", "admin", "leader"].includes(actorMember.role)) && set?.status === "draft";
  const isDirector = Boolean(canValidate && actorMember?.is_director);
  const reviewedVotesMatch = !q.hasDoubt || JSON.stringify([...q.current.map((item) => item.id)].sort()) ===
    JSON.stringify([...(review ? JSON.parse(review.source_ids_json) as string[] : [])].sort());
  const canFreeze = isDirector && diagnosticApproved && issues.length === 0 && q.ready && reviewedVotesMatch &&
    (!q.hasDoubt || review?.status === "approved") && review?.status !== "changes_requested";
  const error = params.error ? errors[params.error] : null;

  return <AppShell active="foda"><div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#192538]"><ArrowLeft className="size-4" /> Volver al plan</Link>
    <div className="mt-6"><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5A626F]">Subetapa de preparación · Sprint 3</p><h1 className="mt-2 text-3xl font-semibold text-[#192538]">FODA base: depuración y aprobación</h1><p className="mt-3 max-w-4xl text-[15px] leading-7 text-[#5A626F]">Esta pantalla cierra la lista de factores F, D, O y A con sus evidencias. Los cruces FO y DA, puntajes y prioridades se construirán en el Sprint 4, usando únicamente la versión aprobada de esta lista.</p></div>
    <div className="mt-5 flex flex-wrap gap-2"><Link href="/modulos/analisis-interno" className="rounded-lg border border-[#E6DFD6] bg-white px-4 py-2 text-sm font-medium text-[#192538]">Editar análisis interno</Link><Link href="/modulos/analisis-externo" className="rounded-lg border border-[#E6DFD6] bg-white px-4 py-2 text-sm font-medium text-[#192538]">Editar análisis externo</Link></div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {(params.validated || params.reviewed || params.frozen || params.reopened) && <p role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-[#E6C99F] bg-[#FBF5EB] p-4 text-sm text-[#192538]"><CircleCheck className="size-4" /> {params.frozen ? "Conjunto aprobado y congelado." : params.reopened ? "Nueva versión de trabajo abierta; las validaciones anteriores permanecen en el historial." : params.reviewed ? "Revisión del consultor registrada." : "Participación del líder registrada."}</p>}

    <div className="mt-8 grid gap-5 md:grid-cols-4">{FODA_AXES.map((axis) => { const active = factors.filter((item) => item.axis === axis && item.status !== "discarded"); return <section key={axis} className="rounded-xl border border-[#E6DFD6] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5A626F]">{axis}</p><h2 className="mt-1 text-lg font-semibold text-[#192538]">{axisLabels[axis]}</h2><p className="mt-3 text-2xl font-semibold text-[#192538]">{active.length}<span className="text-base font-normal text-[#5A626F]">/{MAX_FODA_FACTORS_PER_AXIS}</span></p><p className="mt-2 text-xs text-[#5A626F]">{active.filter((item) => evidence.some((entry) => entry.factor_id === item.id)).length} con evidencia</p></section>; })}</div>

    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]"><section className="rounded-2xl border border-[#E6DFD6] bg-white p-6 lg:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-[#192538]">Control de calidad</h2><span className="rounded-full bg-[#FBF5EB] px-3 py-1 text-xs font-semibold text-[#192538]">Lista v{set?.version ?? 1} · revisión {set?.revision ?? 0} · {set?.status === "frozen" ? "congelada" : "borrador"}</span></div><p className="mt-3 text-sm text-[#5A626F]">Se comprueba evidencia mínima, las cuatro categorías, duplicados de descripción, estado y máximo 10 por categoría. La clasificación estratégica queda a juicio del equipo y se fundamenta por factor.</p>
      {!diagnosticApproved && set?.status !== "frozen" && <p className="mt-5 rounded-lg border border-[#E6C99F] bg-[#FBF5EB] p-3 text-sm text-[#192538]">La revisión vigente del diagnóstico estratégico está pendiente. Sus antecedentes se pueden usar para preparar borradores; la lista FODA no se cerrará hasta que el consultor apruebe el diagnóstico actual.</p>}
      {diagnosticChangedSinceFreeze && <p className="mt-5 rounded-lg border border-[#E6C99F] bg-[#FBF5EB] p-3 text-sm text-[#192538]">El diagnóstico vigente cambió después del cierre de esta versión. La dirección debe revisar si corresponde reabrir el FODA antes de utilizarlo en matrices posteriores.</p>}
      {issues.length ? <ul className="mt-5 space-y-2">{issues.map((issue, index) => <li key={`${index}-${issue}`} className="rounded-lg border border-[#E6C99F] bg-[#FBF5EB] p-3 text-sm text-[#192538]">{issue}</li>)}</ul> : <p className="mt-5 flex items-center gap-2 rounded-lg border border-[#D6A871] bg-[#FBF5EB] p-4 text-sm text-[#192538]"><CircleCheck className="size-4" /> Lista completa para la validación humana. Aún no existen puntajes de FODA cuantitativa.</p>}
      <div className="mt-6 space-y-4">{FODA_AXES.map((axis) => <div key={axis}><h3 className="text-base font-semibold text-[#192538]">{axisLabels[axis]}</h3><div className="mt-2 space-y-2">{factors.filter((item) => item.axis === axis).map((factor) => <div key={factor.id} className="rounded-lg border border-[#EEE8DF] p-3 text-sm"><p><strong>{factor.code}</strong> · {factor.description}</p><p className="mt-1 text-xs text-[#5A626F]">{factor.status === "discarded" ? "Descartado; se conserva en historial" : factor.status === "needs_clarification" ? "Requiere aclaración" : factor.status === "approved" ? "Aprobado" : "Propuesto"} · {evidence.filter((item) => item.factor_id === factor.id).length} evidencia(s) · v{factor.version}</p></div>)}{!factors.some((item) => item.axis === axis) && <p className="text-sm text-[#5A626F]">[FALTA]</p>}</div></div>)}</div>
      </section>
      <aside className="space-y-6"><section className="rounded-2xl border border-[#E6DFD6] bg-white p-6"><h2 className="text-xl font-semibold text-[#192538]">Validación del Equipo de Alto Nivel</h2><p className="mt-3 text-sm leading-6 text-[#5A626F]">Se procura la participación de los cinco líderes designados. Para cerrar se necesitan al menos {MIN_VALIDATION_QUORUM} participaciones vigentes, incluido el gerente general o máximo director. Una solicitud de cambios detiene el cierre.</p><p className="mt-4 text-sm font-semibold text-[#192538]">{q.count}/{MIN_VALIDATION_QUORUM} participaciones válidas · director {q.hasDirector ? "incluido" : "pendiente"}</p><div className="mt-3 space-y-2">{q.current.map((item) => { const member = members.find((entry) => entry.id === item.member_id); return <div key={item.id} className="rounded-lg bg-[#FAF8F4] p-3 text-sm"><strong>{member?.display_name ?? "Líder"}</strong> · {item.decision === "validated" ? "valida" : item.decision === "doubt" ? "plantea duda" : "solicita cambios"}<p className="mt-1 text-xs text-[#5A626F]">{item.rationale}</p></div>; })}{q.current.length === 0 && <p className="text-sm text-[#5A626F]">Todavía no hay validaciones para esta revisión.</p>}</div>
        {canValidate && issues.length === 0 && !review && <form action={validateFodaSet} className="mt-5 space-y-3 border-t border-[#E6DFD6] pt-5"><input type="hidden" name="expected_revision" value={set?.revision ?? 0} /><Label htmlFor="foda-decision">Tu decisión sobre la lista completa</Label><NativeSelect id="foda-decision" name="decision" defaultValue="validated" className="h-11 w-full bg-white text-base"><NativeSelectOption value="validated">Validar lista</NativeSelectOption><NativeSelectOption value="doubt">Registrar duda para el consultor</NativeSelectOption><NativeSelectOption value="changes_requested">Solicitar cambios al equipo</NativeSelectOption></NativeSelect><Label htmlFor="foda-rationale">Fundamento o duda concreta</Label><Textarea id="foda-rationale" name="rationale" required minLength={10} maxLength={1500} className="min-h-24 bg-white text-base" /><Button type="submit">Registrar mi participación</Button></form>}
      </section>
      <section className="rounded-2xl border border-[#E6C99F] bg-[#FBF5EB] p-6"><h2 className="text-xl font-semibold text-[#192538]">Puerta de cierre</h2><p className="mt-3 text-sm leading-6 text-[#5A626F]">{q.hasDoubt ? "Hay una duda vigente: el consultor debe revisar las evidencias y registrarla como aprobada o solicitar cambios." : "La revisión del consultor es excepcional para factores FODA: interviene si quedan dudas documentadas."}</p>{review && <p className="mt-4 rounded-lg bg-white p-3 text-sm text-[#192538]">Consultor: {review.status === "approved" ? "aprueba la resolución de dudas" : "solicita cambios"}. {review.rationale}</p>}
        {actor.role === "consultant" && diagnosticApproved && q.ready && q.hasDoubt && !review && issues.length === 0 && set?.status === "draft" && <form action={reviewFodaDoubt} className="mt-5 space-y-3"><input type="hidden" name="expected_revision" value={set.revision} /><Label htmlFor="consultant-rationale">Resolución metodológica de la duda</Label><Textarea id="consultant-rationale" name="rationale" required minLength={10} maxLength={1500} className="min-h-24 bg-white text-base" /><div className="flex flex-wrap gap-2"><Button type="submit" name="decision" value="approved">Aprobar resolución</Button><Button type="submit" name="decision" value="changes_requested" variant="outline">Solicitar cambios</Button></div></form>}
        {set?.status === "frozen" ? <p className="mt-4 flex items-center gap-2 text-sm font-medium text-[#192538]"><LockKeyhole className="size-4" /> Versión {set.version} cerrada para matrices.</p> : <p className="mt-4 text-sm text-[#5A626F]">{canFreeze ? "La dirección ya puede aprobar y congelar la lista." : "El cierre permanece pendiente hasta resolver los controles y el quórum."}</p>}
        {canFreeze && <form action={freezeFodaSet} className="mt-4"><input type="hidden" name="expected_revision" value={set?.revision ?? 0} /><Button type="submit">Aprobar y congelar FODA base</Button></form>}
        {set?.status === "frozen" && actorMember?.is_director && actorMember?.is_leader && <form action={reopenFodaSet} className="mt-5 space-y-3 border-t border-[#D6A871] pt-5"><input type="hidden" name="expected_version" value={set.version} /><Label htmlFor="reopen-reason">Motivo para reabrir una nueva versión</Label><Textarea id="reopen-reason" name="reason" required minLength={10} maxLength={1500} className="min-h-24 bg-white text-base" /><Button type="submit" variant="outline">Reabrir bajo responsabilidad de dirección</Button></form>}
      </section></aside></div>

    <section className="mt-8 rounded-2xl border border-[#E6DFD6] bg-white p-6 lg:p-8"><h2 className="text-xl font-semibold text-[#192538]">Versiones cerradas</h2><p className="mt-2 text-sm text-[#5A626F]">Cada cierre conserva los factores, evidencias, participantes y revisión aplicable. Reabrir no borra el resultado anterior.</p>{snapshots.length === 0 ? <p className="mt-4 text-sm text-[#5A626F]">Aún no hay una versión cerrada.</p> : <div className="mt-4 space-y-3">{snapshots.map((snapshot) => { const content = JSON.parse(snapshot.snapshot_json) as { factors: Array<{ code: string; description: string; status: string }> }; return <details key={snapshot.id} className="rounded-lg border border-[#E6DFD6] p-4"><summary className="cursor-pointer text-sm font-semibold text-[#192538]">Versión {snapshot.version} · {snapshot.frozen_at} · {content.factors.filter((item) => item.status === "approved").length} factores aprobados</summary><ul className="mt-3 space-y-2 text-sm text-[#5A626F]">{content.factors.map((item) => <li key={item.code}>{item.code} · {item.description} {item.status === "discarded" ? "(descartado)" : ""}</li>)}</ul></details>; })}</div>}
    </section>
  </div></AppShell>;
}
