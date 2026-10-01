import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, LockKeyhole } from "lucide-react";
import { savePhilosophyAnswer, savePhilosophyStatement, saveValueBehavior, reviewPhilosophyStatement, reviewValues } from "@/app/sprint2-actions";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { canRead, getActor } from "@/lib/authz";
import { getCurrentCycle, getMembers, getOrganization } from "@/lib/workspace";
import { getPhilosophyAnswers, getPhilosophyStatements, getValueBehaviors, isHighLevelMember, latestApproval, philosophyQuestions, statementSubject, valuesSubject } from "@/lib/sprint2";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  permission: "Tu rol no permite realizar esta acción.", cycle: "Primero registra el ciclo estratégico.",
  invalid: "Revisa los campos obligatorios y la longitud de las respuestas.",
  incomplete: "Completa las preguntas de este enunciado antes de enviarlo a revisión.",
  statements: "La misión y la visión necesitan aprobación antes de registrar valores.",
  missing: "No se encontró el registro que intentas editar.",
};

export default async function PhilosophyPage({ searchParams }: { searchParams: Promise<{ q?: string; editValue?: string; error?: string; saved?: string; reviewed?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/organizacion/filosofia"));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const organization = await getOrganization();
  const cycle = organization ? await getCurrentCycle(organization.id) : null;
  if (!organization || !cycle) redirect("/organizacion");
  const [answers, statements, values, members, params] = await Promise.all([
    getPhilosophyAnswers(cycle.id), getPhilosophyStatements(cycle.id), getValueBehaviors(cycle.id), getMembers(organization.id), searchParams,
  ]);
  const canWrite = await isHighLevelMember(organization.id, actor.memberId);
  const questionIndex = Math.max(0, philosophyQuestions.findIndex((item) => item.key === params.q));
  const question = philosophyQuestions[questionIndex];
  const answer = answers.find((item) => item.question_key === question.key);
  const writer = answer ? members.find((item) => item.auth_user_id === answer.updated_by_user_id) : null;
  const statementReviews = await Promise.all(statements.map(async (item) => [item.kind, await latestApproval(cycle.id, `philosophy.${item.kind}`, statementSubject(item))] as const));
  const reviewByKind = new Map(statementReviews);
  const statementsApproved = statements.length === 2 && statements.every((item) => reviewByKind.get(item.kind)?.status === "approved");
  const valuesReview = values.length ? await latestApproval(cycle.id, "philosophy.values", valuesSubject(values, statements)) : null;
  const editValue = values.find((item) => item.id === params.editValue);
  const completed = philosophyQuestions.filter((item) => answers.some((response) => response.question_key === item.key && response.answer)).length;
  const error = params.error ? errors[params.error] : null;

  return <AppShell active="organizacion"><div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/organizacion" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#47746f] hover:text-[#0e766f]"><ArrowLeft className="size-4" /> Información de la empresa</Link>
    <div className="mt-6"><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#287c78]">Módulo 01 · Filosofía empresarial</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102b3f]">Misión, visión y valores</h1><p className="mt-3 max-w-3xl text-[16px] leading-7 text-[#597180]">El Equipo de Alto Nivel registra respuestas acordadas. Los enunciados son borradores del equipo hasta que el consultor los revise. No hay contenido generado por IA en esta fase del piloto.</p></div>
    {error && <p role="alert" className="mt-6 rounded-xl border border-[#e5bcbc] bg-[#fff4f2] p-4 text-[14px] text-[#9d3737]">{error}</p>}
    {(params.saved || params.reviewed) && <p role="status" className="mt-6 flex items-center gap-2 rounded-xl border border-[#b9dcd4] bg-[#eaf8f4] p-4 text-[14px] text-[#286a61]"><CircleCheck className="size-5" /> {params.reviewed ? "Revisión registrada." : "Respuesta guardada."}</p>}
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#287c78]">{question.group === "mission" ? "Misión" : "Visión"} · Pregunta {questionIndex + 1} de 10</p><h2 className="mt-2 text-xl font-semibold text-[#102b3f]">{question.question}</h2></div><span className="text-[14px] font-medium text-[#3c7c75]">{completed}/10 respondidas</span></div>
        <Progress value={completed * 10} className="mt-5 h-2 bg-[#e2eeee]" />
        <p className="mt-5 text-[14px] leading-6 text-[#5c7480]">Por qué se solicita: {question.why}</p>
        <form action={savePhilosophyAnswer} className="mt-5 space-y-4"><input type="hidden" name="question_key" value={question.key} /><Label htmlFor="workshop-answer">Respuesta acordada por el equipo</Label><Textarea id="workshop-answer" name="answer" defaultValue={answer?.answer ?? ""} minLength={3} maxLength={2000} required disabled={!canWrite} className="min-h-40 bg-white text-[16px]" />
          <p className="text-[13px] leading-5 text-[#6b828d]">{answer ? `Última edición: ${writer?.display_name ?? "integrante del equipo"} · versión ${answer.version}.` : "Aún no hay respuesta."} Cada cambio conserva su versión anterior en la auditoría.</p>
          <div className="flex flex-wrap justify-between gap-3"><Button asChild variant="outline"><Link href={`/organizacion/filosofia?q=${philosophyQuestions[Math.max(0, questionIndex - 1)].key}`}>Anterior</Link></Button><div className="flex gap-2">{canWrite && <Button type="submit">Guardar respuesta</Button>}<Button asChild variant="outline"><Link href={`/organizacion/filosofia?q=${philosophyQuestions[Math.min(9, questionIndex + 1)].key}`}>Siguiente</Link></Button></div></div>
        </form>
      </section>
      <aside className="rounded-2xl border border-[#dbe5e7] bg-white p-5"><h2 className="text-[16px] font-semibold text-[#102b3f]">Resumen de respuestas</h2><div className="mt-4 space-y-2">{philosophyQuestions.map((item, index) => { const done = answers.some((response) => response.question_key === item.key && response.answer); return <Link key={item.key} href={`/organizacion/filosofia?q=${item.key}`} className={`flex items-start gap-3 rounded-lg px-3 py-2 text-[14px] ${question.key === item.key ? "bg-[#e9f4f3] text-[#0c6660]" : "text-[#4b6573] hover:bg-[#f4f8f8]"}`}><span className="font-semibold">{String(index + 1).padStart(2, "0")}</span><span className="flex-1">{item.question}</span><span aria-label={done ? "Respondida" : "Pendiente"}>{done ? "✓" : "·"}</span></Link>; })}</div></aside>
    </div>

    <section id="enunciados" className="mt-8 rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8"><h2 className="text-xl font-semibold text-[#102b3f]">Enunciados del equipo</h2><p className="mt-2 text-[14px] text-[#5c7480]">Redacta una propuesta propia a partir de las respuestas. El consultor comprueba claridad, coherencia, viabilidad, diferenciación y horizonte. No se presenta como una conclusión automática.</p><div className="mt-6 grid gap-6 lg:grid-cols-2">{(["mission", "vision"] as const).map((kind) => { const item = statements.find((row) => row.kind === kind); const groupComplete = philosophyQuestions.filter((q) => q.group === kind).every((q) => answers.some((a) => a.question_key === q.key && a.answer)); const review = item ? reviewByKind.get(kind) : null; return <div key={kind} className="rounded-xl border border-[#e1e9ea] p-5"><div className="flex items-center justify-between gap-2"><h3 className="text-[17px] font-semibold text-[#19384a]">{kind === "mission" ? "Misión" : "Visión"}</h3><span className="text-[13px] text-[#587482]">{review?.status === "approved" ? "Aprobada" : review?.status === "changes_requested" ? "Cambios solicitados" : "Borrador"}</span></div><form action={savePhilosophyStatement} className="mt-4 space-y-3"><input type="hidden" name="kind" value={kind} /><Label htmlFor={`${kind}-statement`}>Texto propuesto</Label><Textarea id={`${kind}-statement`} name="statement" defaultValue={item?.statement ?? ""} minLength={20} maxLength={3000} required disabled={!canWrite} className="min-h-36 bg-white text-[16px]" />{canWrite && <Button type="submit" disabled={!groupComplete}>Guardar borrador</Button>}</form><p className="mt-3 text-[13px] text-[#6b828d]">{groupComplete ? "Preguntas completas" : "Completa primero las preguntas de este enunciado"} · versión {item?.version ?? "—"}</p>{review && <p className="mt-3 rounded-lg bg-[#f3f7f7] p-3 text-[14px] text-[#4e6977]">Revisión: {review.rationale}</p>}{actor.role === "consultant" && item && <form action={reviewPhilosophyStatement} className="mt-5 space-y-3 border-t border-[#e1e9ea] pt-4"><input type="hidden" name="kind" value={kind} /><Label htmlFor={`${kind}-rationale`}>Fundamento de la revisión</Label><Textarea id={`${kind}-rationale`} name="rationale" required minLength={10} maxLength={1500} className="min-h-20 bg-white text-[16px]" /><div className="flex gap-2"><Button type="submit" name="decision" value="approved" disabled={!groupComplete}>Aprobar</Button><Button type="submit" name="decision" value="changes_requested" variant="outline">Solicitar cambios</Button></div></form>}</div>; })}</div></section>

    <section id="valores" className="mt-8 rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#102b3f]">Valores y conductas observables</h2><p className="mt-2 text-[14px] text-[#5c7480]">Cada conducta debe vincularse explícitamente con la misión, la visión o ambas.</p></div><span className="text-[13px] text-[#587482]">{valuesReview?.status === "approved" ? "Aprobados" : "Pendientes"}</span></div>
      {!statementsApproved && <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#dce8e7] bg-[#f6faf9] p-4 text-[14px] text-[#52717c]"><LockKeyhole className="mt-0.5 size-4 shrink-0" /> Primero se aprueban los borradores de misión y visión.</div>}
      {values.length > 0 && <div className="mt-5 grid gap-3">{values.map((item) => <article key={item.id} className="rounded-xl border border-[#e1e9ea] p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-[#19384a]">{item.value_name}</h3>{canWrite && statementsApproved && <Link href={`/organizacion/filosofia?editValue=${item.id}#valores`} className="text-[14px] font-medium text-[#0e766f]">Editar</Link>}</div><p className="mt-2 text-[15px] text-[#385463]">{item.behavior}</p><p className="mt-2 text-[13px] text-[#6b828d]">Vínculo con misión: {item.mission_link || "—"} · vínculo con visión: {item.vision_link || "—"} · v{item.version}</p></article>)}</div>}
      {canWrite && statementsApproved && <form action={saveValueBehavior} className="mt-6 grid gap-4 border-t border-[#e1e9ea] pt-6 sm:grid-cols-2"><input type="hidden" name="id" value={editValue?.id ?? ""} /><div className="space-y-2 sm:col-span-2"><Label htmlFor="value-name">Valor</Label><Input id="value-name" name="value_name" defaultValue={editValue?.value_name ?? ""} required minLength={2} maxLength={120} className="h-11 bg-white text-[16px]" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="behavior">Conducta verificable</Label><Textarea id="behavior" name="behavior" defaultValue={editValue?.behavior ?? ""} required minLength={10} maxLength={1500} className="min-h-24 bg-white text-[16px]" /></div><div className="space-y-2"><Label htmlFor="mission-link">Aspecto de la misión que sostiene</Label><Textarea id="mission-link" name="mission_link" defaultValue={editValue?.mission_link ?? ""} maxLength={500} className="min-h-20 bg-white text-[16px]" /></div><div className="space-y-2"><Label htmlFor="vision-link">Componente de la visión al que contribuye</Label><Textarea id="vision-link" name="vision_link" defaultValue={editValue?.vision_link ?? ""} maxLength={500} className="min-h-20 bg-white text-[16px]" /></div><div className="sm:col-span-2"><Button type="submit">{editValue ? "Guardar cambios" : "Añadir conducta"}</Button></div></form>}
      {actor.role === "consultant" && values.length > 0 && <form action={reviewValues} className="mt-6 space-y-3 border-t border-[#e1e9ea] pt-5"><Label htmlFor="values-rationale">Revisión metodológica de los valores</Label><Textarea id="values-rationale" name="rationale" required minLength={10} maxLength={1500} className="min-h-20 bg-white text-[16px]" /><div className="flex gap-2"><Button type="submit" name="decision" value="approved">Aprobar valores</Button><Button type="submit" name="decision" value="changes_requested" variant="outline">Solicitar cambios</Button></div></form>}
    </section>
    <div className="mt-7 flex justify-end"><Button asChild variant="outline"><Link href="/diagnostico">Ir al diagnóstico</Link></Button></div>
  </div></AppShell>;
}
