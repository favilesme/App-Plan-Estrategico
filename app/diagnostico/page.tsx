import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { reviewDiagnostic, saveDiagnosticInput } from "@/app/sprint2-actions";
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
import { getCurrentCycle, getMembers, getOrganization } from "@/lib/workspace";
import { diagnosticSubject, getDiagnosticInputs, isHighLevelMember, latestApproval } from "@/lib/sprint2";

export const dynamic = "force-dynamic";

const areas = [
  { key: "operativa", label: "Operativa", prompt: "¿Qué antecedentes operativos son relevantes para entender la situación actual?" },
  { key: "comercial", label: "Comercial", prompt: "¿Qué antecedentes de clientes, mercados y ventas deben revisarse?" },
  { key: "financiera", label: "Financiera", prompt: "¿Qué antecedentes financieros están disponibles y cuáles faltan?" },
] as const;
const errors: Record<string, string> = {
  permission: "Tu rol no permite esta acción.", cycle: "Primero registra el ciclo estratégico.",
  invalid: "Revisa el contenido, la clasificación y la fuente. Un dato aportado necesita una fuente identificable.",
  incomplete: "Registra o marca [FALTA] en los tres ámbitos antes de la revisión.", missing: "No se encontró el aporte para editar.",
};

export default async function DiagnosticPage({ searchParams }: { searchParams: Promise<{ area?: string; edit?: string; error?: string; saved?: string; reviewed?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/diagnostico"));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const organization = await getOrganization();
  const cycle = organization ? await getCurrentCycle(organization.id) : null;
  if (!organization || !cycle) redirect("/organizacion");
  const [items, members, params] = await Promise.all([getDiagnosticInputs(cycle.id), getMembers(organization.id), searchParams]);
  const canWrite = await isHighLevelMember(organization.id, actor.memberId);
  const selectedArea = areas.find((item) => item.key === params.area) ?? areas[0];
  const editing = items.find((item) => item.id === params.edit);
  const represented = areas.filter((area) => items.some((item) => item.area === area.key)).length;
  const review = items.length ? await latestApproval(cycle.id, "diagnostic.review", diagnosticSubject(items)) : null;
  const progress = Math.round((represented + Number(review?.status === "approved")) * 25);
  const error = params.error ? errors[params.error] : null;

  return <AppShell active="diagnostico"><div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#47746f] hover:text-[#0e766f]"><ArrowLeft className="size-4" /> Volver al plan</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#287c78]">Módulo 02</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102b3f]">Diagnóstico estratégico</h1><p className="mt-3 max-w-3xl text-[16px] leading-7 text-[#597180]">Recoge antecedentes de la empresa con su fuente y periodo. Cada registro distingue un dato aportado, un supuesto y una falta de información. El diagnóstico no genera una puntuación general.</p></div><span className="text-2xl font-semibold text-[#0e766f]">{progress}%</span></div>
    <Progress value={progress} className="mt-6 h-2 bg-[#e2eeee]" />
    {error && <p role="alert" className="mt-6 rounded-xl border border-[#e5bcbc] bg-[#fff4f2] p-4 text-[14px] text-[#9d3737]">{error}</p>}
    {(params.saved || params.reviewed) && <p role="status" className="mt-6 flex items-center gap-2 rounded-xl border border-[#b9dcd4] bg-[#eaf8f4] p-4 text-[14px] text-[#286a61]"><CircleCheck className="size-5" /> {params.reviewed ? "Revisión registrada." : "Aporte guardado."}</p>}
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
      <section className="rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8"><p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#287c78]">Captura guiada</p><h2 className="mt-2 text-xl font-semibold text-[#102b3f]">{selectedArea.label}</h2><p className="mt-3 text-[14px] leading-6 text-[#5c7480]">{selectedArea.prompt} Solicitar fuente y periodo permite comprobar cada afirmación antes de convertirla en factor estratégico.</p>
        <form action={saveDiagnosticInput} className="mt-6 grid gap-5 sm:grid-cols-2"><input type="hidden" name="id" value={editing?.id ?? ""} /><div className="space-y-2"><Label htmlFor="area">Ámbito</Label><NativeSelect id="area" name="area" defaultValue={editing?.area ?? selectedArea.key} disabled={!canWrite} className="h-11 w-full bg-white text-[16px]">{areas.map((item) => <NativeSelectOption value={item.key} key={item.key}>{item.label}</NativeSelectOption>)}</NativeSelect></div><div className="space-y-2"><Label htmlFor="classification">Tipo de información</Label><NativeSelect id="classification" name="classification" defaultValue={editing?.classification ?? "dato"} disabled={!canWrite} className="h-11 w-full bg-white text-[16px]"><NativeSelectOption value="dato">Dato aportado por el cliente</NativeSelectOption><NativeSelectOption value="supuesto">Supuesto por validar</NativeSelectOption><NativeSelectOption value="falta">[FALTA] Información pendiente</NativeSelectOption></NativeSelect></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="statement">Antecedente o información pendiente</Label><Textarea id="statement" name="statement" defaultValue={editing?.statement ?? ""} required minLength={5} maxLength={3000} disabled={!canWrite} className="min-h-32 bg-white text-[16px]" /></div>
          <div className="space-y-2"><Label htmlFor="source-type">Origen</Label><NativeSelect id="source-type" name="source_type" defaultValue={editing?.source_type ?? "documento"} disabled={!canWrite} className="h-11 w-full bg-white text-[16px]"><NativeSelectOption value="documento">Documento</NativeSelectOption><NativeSelectOption value="entrevista">Entrevista o taller</NativeSelectOption><NativeSelectOption value="reporte_empresa">Reporte de la empresa</NativeSelectOption><NativeSelectOption value="otra">Otra fuente</NativeSelectOption><NativeSelectOption value="sin_fuente">Fuente pendiente</NativeSelectOption></NativeSelect></div><div className="space-y-2"><Label htmlFor="period">Periodo al que corresponde</Label><Input id="period" name="period" defaultValue={editing?.period ?? ""} maxLength={120} disabled={!canWrite} placeholder="Ej. enero–junio 2026 o [FALTA]" className="h-11 bg-white text-[16px]" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="source-detail">Referencia concreta de la fuente</Label><Input id="source-detail" name="source_detail" defaultValue={editing?.source_detail ?? ""} maxLength={1000} disabled={!canWrite} placeholder="Documento, entrevista, responsable o [FALTA]" className="h-11 bg-white text-[16px]" /><p className="text-[13px] text-[#6b828d]">Obligatoria para clasificar el registro como dato aportado. No equivale a verificación independiente.</p></div>{canWrite && <div className="sm:col-span-2"><Button type="submit">{editing ? "Guardar cambios" : "Registrar aporte"}</Button></div>}</form>
      </section>
      <aside className="rounded-2xl border border-[#dbe5e7] bg-white p-5"><h2 className="text-[16px] font-semibold text-[#102b3f]">Cobertura del diagnóstico</h2><p className="mt-2 text-[14px] text-[#6b828d]">{represented}/3 ámbitos registrados</p><div className="mt-4 space-y-2">{areas.map((area) => { const count = items.filter((item) => item.area === area.key).length; return <Link key={area.key} href={`/diagnostico?area=${area.key}`} className={`flex items-center justify-between rounded-lg px-3 py-3 text-[14px] ${selectedArea.key === area.key ? "bg-[#e9f4f3] text-[#0c6660]" : "text-[#4b6573] hover:bg-[#f4f8f8]"}`}><span>{area.label}</span><span>{count ? `${count} aporte${count === 1 ? "" : "s"}` : "[FALTA]"}</span></Link>; })}</div><div className="mt-6 border-t border-[#e1e9ea] pt-4 text-[13px] leading-5 text-[#6b828d]">Los líderes canalizan aportes de otros colaboradores y conservan la responsabilidad de lo que registran. Los observadores solo pueden leer.</div></aside>
    </div>
    <section className="mt-8 rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-[#102b3f]">Información recopilada</h2><span className="text-[14px] text-[#587482]">{items.length} registros · {review?.status === "approved" ? "revisado" : "revisión pendiente"}</span></div>{items.length === 0 ? <p className="mt-5 text-[15px] text-[#6b828d]">Aún no hay antecedentes registrados.</p> : <div className="mt-5 space-y-3">{items.map((item) => { const member = members.find((row) => row.auth_user_id === item.created_by_user_id); return <article key={item.id} className="rounded-xl border border-[#e1e9ea] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#287c78]">{areas.find((area) => area.key === item.area)?.label} · {item.classification === "dato" ? "Dato aportado" : item.classification === "supuesto" ? "Supuesto" : "[FALTA]"}</span>{canWrite && <Link href={`/diagnostico?area=${item.area}&edit=${item.id}`} className="text-[14px] font-medium text-[#0e766f]">Editar</Link>}</div><p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-[#244557]">{item.statement}</p><p className="mt-3 text-[13px] leading-5 text-[#6b828d]">Fuente: {item.source_detail || "[FALTA]"} · Periodo: {item.period || "[FALTA]"} · Aportó: {member?.display_name ?? "integrante del equipo"} · v{item.version}</p></article>; })}</div>}
      {review && <div className="mt-5 rounded-xl bg-[#f3f7f7] p-4 text-[14px] text-[#4e6977]">Revisión del consultor: {review.rationale}</div>}
      {actor.role === "consultant" && items.length > 0 && <form action={reviewDiagnostic} className="mt-6 space-y-3 border-t border-[#e1e9ea] pt-5"><Label htmlFor="diagnostic-rationale">Fundamento de la revisión</Label><Textarea id="diagnostic-rationale" name="rationale" minLength={10} maxLength={1500} required className="min-h-24 bg-white text-[16px]" /><p className="text-[13px] text-[#6b828d]">La revisión valida la recopilación y sus vacíos documentados; no convierte supuestos en datos verificados.</p><div className="flex gap-2"><Button type="submit" name="decision" value="approved" disabled={represented < 3}>Aprobar recopilación</Button><Button type="submit" name="decision" value="changes_requested" variant="outline">Solicitar cambios</Button></div></form>}
    </section>
  </div></AppShell>;
}
