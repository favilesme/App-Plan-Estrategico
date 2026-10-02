import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, LockKeyhole } from "lucide-react";
import {
  reviewPhilosophyStatement, reviewValue, savePhilosophyAnswer,
  savePhilosophyStatement, saveValueBehavior,
} from "@/app/sprint2-actions";
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
import {
  getPhilosophyAnswers, getPhilosophyStatements, getValueBehaviors,
  getValueReviewRecords, isHighLevelMember, latestApproval,
  philosophyQuestions, statementSubject,
} from "@/lib/sprint2";
import {
  lastIndividualValueReview, lastLegacyValueReview, resolveValueReview,
} from "@/lib/value-review";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  permission: "Tu rol no permite realizar esta acción.",
  cycle: "Primero registra el ciclo estratégico.",
  invalid: "Revisa los campos obligatorios y la longitud de las respuestas.",
  incomplete: "Completa las preguntas de este enunciado antes de enviarlo a revisión.",
  statements: "La misión y la visión necesitan aprobación antes de registrar valores.",
  missing: "No se encontró el registro que intentas editar.",
  stale: "Este contenido fue modificado por otra persona. Revisa la versión actual antes de guardar o aprobar.",
};

const groups = [
  { key: "mission", title: "Preguntas de Misión", description: "Respuestas que fundamentan la misión actual." },
  { key: "vision", title: "Preguntas de Visión", description: "Respuestas que fundamentan la visión futura." },
] as const;

export default async function PhilosophyPage({ searchParams }: {
  searchParams: Promise<{ q?: string; editValue?: string; error?: string; saved?: string; reviewed?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/organizacion/filosofia"));
  if (actor.role === "unconfigured" || !canRead(actor.role)) {
    return <AccessNotice configured={actor.role !== "unconfigured"} />;
  }
  const organization = await getOrganization();
  const cycle = organization ? await getCurrentCycle(organization.id) : null;
  if (!organization || !cycle) redirect("/organizacion");

  const [answers, statements, values, valueReviews, members, params] = await Promise.all([
    getPhilosophyAnswers(cycle.id), getPhilosophyStatements(cycle.id),
    getValueBehaviors(cycle.id), getValueReviewRecords(cycle.id),
    getMembers(organization.id), searchParams,
  ]);
  const canWrite = await isHighLevelMember(organization.id, actor.memberId);
  const questionIndex = Math.max(0, philosophyQuestions.findIndex((item) => item.key === params.q));
  const question = philosophyQuestions[questionIndex];
  const groupQuestions = philosophyQuestions.filter((item) => item.group === question.group);
  const groupQuestionIndex = groupQuestions.findIndex((item) => item.key === question.key);
  const answer = answers.find((item) => item.question_key === question.key);
  const writer = answer ? members.find((item) => item.auth_user_id === answer.updated_by_user_id) : null;
  const statementReviews = await Promise.all(statements.map(async (item) =>
    [item.kind, await latestApproval(cycle.id, `philosophy.${item.kind}`, statementSubject(item))] as const
  ));
  const reviewByKind = new Map(statementReviews);
  const statementsApproved = statements.length === 2 && statements.every((item) => reviewByKind.get(item.kind)?.status === "approved");
  const reviewsByValue = new Map(values.map((item) => [item.id, resolveValueReview(item, statements, valueReviews)]));
  const allValuesApproved = values.length > 0 && statementsApproved && values.every((item) => reviewsByValue.get(item.id)?.record.status === "approved");
  const legacyGroupReview = lastLegacyValueReview(valueReviews);
  const hasChangesRequested = values.some((item) => reviewsByValue.get(item.id)?.record.status === "changes_requested") ||
    (legacyGroupReview?.status === "changes_requested" && !allValuesApproved);
  const editValue = values.find((item) => item.id === params.editValue);
  const completed = philosophyQuestions.filter((item) => answers.some((response) => response.question_key === item.key && response.answer)).length;
  const error = params.error ? errors[params.error] : null;

  return <AppShell active="organizacion"><div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/organizacion" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#47746f] hover:text-[#0e766f]"><ArrowLeft className="size-4" /> Información de la empresa</Link>
    <div className="mt-6">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#287c78]">Módulo 01 · Filosofía empresarial</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102b3f]">Misión, visión y valores</h1>
      <p className="mt-3 max-w-3xl text-[16px] leading-7 text-[#597180]">El Equipo de Alto Nivel registra respuestas acordadas. Los enunciados son borradores del equipo hasta que el consultor los revise. No hay contenido generado por IA en esta fase del piloto.</p>
    </div>
    {error && <p role="alert" className="mt-6 rounded-xl border border-[#e5bcbc] bg-[#fff4f2] p-4 text-[14px] text-[#9d3737]">{error}</p>}
    {(params.saved || params.reviewed) && <p role="status" className="mt-6 flex items-center gap-2 rounded-xl border border-[#b9dcd4] bg-[#eaf8f4] p-4 text-[14px] text-[#286a61]"><CircleCheck className="size-5" /> {params.reviewed ? "Revisión registrada." : "Información guardada."}</p>}

    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#287c78]">Bloque de {question.group === "mission" ? "Misión" : "Visión"} · Pregunta {groupQuestionIndex + 1} de {groupQuestions.length}</p>
            <h2 className="mt-2 text-xl font-semibold text-[#102b3f]">{question.question}</h2>
          </div>
          <span className="text-[14px] font-medium text-[#3c7c75]">{completed}/10 respondidas</span>
        </div>
        <Progress value={completed * 10} className="mt-5 h-2 bg-[#e2eeee]" />
        <p className="mt-5 text-[14px] leading-6 text-[#5c7480]">Por qué se solicita: {question.why}</p>
        <form key={`${question.key}:v${answer?.version ?? 0}`} action={savePhilosophyAnswer} className="mt-5 space-y-4">
          <input type="hidden" name="question_key" value={question.key} />
          <input type="hidden" name="expected_version" value={answer?.version ?? 0} />
          <Label htmlFor="workshop-answer">Respuesta acordada por el equipo</Label>
          <Textarea id="workshop-answer" name="answer" defaultValue={answer?.answer ?? ""} minLength={3} maxLength={2000} required disabled={!canWrite} className="min-h-40 bg-white text-[16px]" />
          <p className="text-[13px] leading-5 text-[#6b828d]">{answer ? `Última edición: ${writer?.display_name ?? "integrante del equipo"} · versión ${answer.version}.` : "Aún no hay respuesta."} Cada cambio conserva su versión anterior en la auditoría.</p>
          <div className="flex flex-wrap justify-between gap-3">
            <Button asChild variant="outline"><Link href={`/organizacion/filosofia?q=${philosophyQuestions[Math.max(0, questionIndex - 1)].key}`}>Anterior</Link></Button>
            <div className="flex gap-2">
              {canWrite && <Button type="submit">Guardar respuesta</Button>}
              <Button asChild variant="outline"><Link href={`/organizacion/filosofia?q=${philosophyQuestions[Math.min(philosophyQuestions.length - 1, questionIndex + 1)].key}`}>{questionIndex === 3 ? "Ir a Visión" : "Siguiente"}</Link></Button>
            </div>
          </div>
        </form>
      </section>
      <aside className="rounded-2xl border border-[#dbe5e7] bg-white p-5">
        <h2 className="text-[16px] font-semibold text-[#102b3f]">Ruta de preguntas</h2>
        {groups.map((group) => {
          const items = philosophyQuestions.filter((item) => item.group === group.key);
          const answered = items.filter((item) => answers.some((response) => response.question_key === item.key && response.answer)).length;
          return <section key={group.key} className="mt-5 border-t border-[#e1e9ea] pt-4">
            <h3 className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[#176f69]">{group.title} · {answered}/{items.length}</h3>
            <p className="mt-1 text-[12px] leading-5 text-[#708692]">{group.description}</p>
            <div className="mt-3 space-y-1">{items.map((item) => {
              const done = answers.some((response) => response.question_key === item.key && response.answer);
              const index = philosophyQuestions.findIndex((questionItem) => questionItem.key === item.key);
              return <Link key={item.key} href={`/organizacion/filosofia?q=${item.key}`} className={`flex items-start gap-3 rounded-lg px-3 py-2 text-[14px] ${question.key === item.key ? "bg-[#e9f4f3] text-[#0c6660]" : "text-[#4b6573] hover:bg-[#f4f8f8]"}`}>
                <span className="font-semibold">{String(index + 1).padStart(2, "0")}</span><span className="flex-1">{item.question}</span><span aria-label={done ? "Respondida" : "Pendiente"}>{done ? "✓" : "·"}</span>
              </Link>;
            })}</div>
          </section>;
        })}
      </aside>
    </div>

    <section id="enunciados" className="mt-8 rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8">
      <h2 className="text-xl font-semibold text-[#102b3f]">Enunciados del equipo</h2>
      <p className="mt-2 text-[14px] text-[#5c7480]">Redacta una propuesta propia a partir de las respuestas de su bloque. El consultor comprueba claridad, coherencia, viabilidad, diferenciación y horizonte.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">{(["mission", "vision"] as const).map((kind) => {
        const item = statements.find((row) => row.kind === kind);
        const blockQuestions = philosophyQuestions.filter((q) => q.group === kind);
        const groupComplete = blockQuestions.every((q) => answers.some((a) => a.question_key === q.key && a.answer));
        const review = item ? reviewByKind.get(kind) : null;
        return <div key={kind} className="rounded-xl border border-[#e1e9ea] p-5">
          <div className="flex items-center justify-between gap-2"><h3 className="text-[17px] font-semibold text-[#19384a]">{kind === "mission" ? "Misión" : "Visión"}</h3><span className="text-[13px] text-[#587482]">{review?.status === "approved" ? "Aprobada" : review?.status === "changes_requested" ? "Cambios solicitados" : "Borrador"}</span></div>
          <details className="mt-4 rounded-lg bg-[#f4f8f8] p-3 text-[14px] text-[#42606e]"><summary className="cursor-pointer font-medium">Ver las {blockQuestions.length} respuestas de {kind === "mission" ? "Misión" : "Visión"}</summary><div className="mt-3 space-y-3">{blockQuestions.map((q) => <div key={q.key}><p className="font-medium">{q.question}</p><p className="mt-1 whitespace-pre-wrap">{answers.find((a) => a.question_key === q.key)?.answer || "[FALTA]"}</p></div>)}</div></details>
          <form action={savePhilosophyStatement} className="mt-4 space-y-3"><input type="hidden" name="kind" value={kind} /><Label htmlFor={`${kind}-statement`}>Texto propuesto</Label><Textarea id={`${kind}-statement`} name="statement" defaultValue={item?.statement ?? ""} minLength={20} maxLength={3000} required disabled={!canWrite} className="min-h-36 bg-white text-[16px]" />{canWrite && <Button type="submit" disabled={!groupComplete}>Guardar borrador</Button>}</form>
          <p className="mt-3 text-[13px] text-[#6b828d]">{groupComplete ? "Preguntas completas" : "Completa primero las preguntas de este enunciado"} · versión {item?.version ?? "—"}</p>
          {review && <p className="mt-3 rounded-lg bg-[#f3f7f7] p-3 text-[14px] text-[#4e6977]">Revisión: {review.rationale}</p>}
          {actor.role === "consultant" && item && <form action={reviewPhilosophyStatement} className="mt-5 space-y-3 border-t border-[#e1e9ea] pt-4"><input type="hidden" name="kind" value={kind} /><Label htmlFor={`${kind}-rationale`}>Fundamento de la revisión</Label><Textarea id={`${kind}-rationale`} name="rationale" required minLength={10} maxLength={1500} className="min-h-20 bg-white text-[16px]" /><div className="flex gap-2"><Button type="submit" name="decision" value="approved" disabled={!groupComplete}>Aprobar</Button><Button type="submit" name="decision" value="changes_requested" variant="outline">Solicitar cambios</Button></div></form>}
        </div>;
      })}</div>
    </section>

    <section id="valores" className="mt-8 rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#102b3f]">Valores y conductas observables</h2><p className="mt-2 text-[14px] text-[#5c7480]">Cada conducta debe vincularse explícitamente con la misión, la visión o ambas. Cada set se revisa por separado.</p></div><span className="text-[13px] text-[#587482]">{allValuesApproved ? "Aprobados" : hasChangesRequested ? "Cambios solicitados" : "Pendientes de revisión"}</span></div>
      {!statementsApproved && <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#dce8e7] bg-[#f6faf9] p-4 text-[14px] text-[#52717c]"><LockKeyhole className="mt-0.5 size-4 shrink-0" /> Primero se aprueban los borradores de misión y visión.</div>}
      {legacyGroupReview?.status === "changes_requested" && !allValuesApproved && <div role="status" className="mt-5 rounded-xl border border-[#e8cfaa] bg-[#fff8ea] p-4 text-[14px] text-[#754f22]"><p className="font-semibold">Cambios solicitados al conjunto de valores en una revisión anterior</p><p className="mt-1 whitespace-pre-wrap">{legacyGroupReview.rationale}</p><p className="mt-2 text-[13px]">Esta observación anterior corresponde al conjunto; las revisiones nuevas se muestran en cada set.</p></div>}
      {values.length > 0 && <div className="mt-5 grid gap-4">{values.map((item) => {
        const resolved = reviewsByValue.get(item.id);
        const review = resolved?.record;
        const priorReview = !review ? lastIndividualValueReview(item, valueReviews) : null;
        const status = review?.status === "approved" ? "Aprobado" : review?.status === "changes_requested" ? "Cambios solicitados" : priorReview ? "Pendiente de nueva revisión" : "Pendiente de revisión";
        return <article key={item.id} className="rounded-xl border border-[#e1e9ea] p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-[#19384a]">{item.value_name}</h3><div className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${review?.status === "approved" ? "bg-[#e5f5ee] text-[#267253]" : review?.status === "changes_requested" ? "bg-[#fff1e8] text-[#9c5425]" : "bg-[#eef3f5] text-[#58717c]"}`}>{status}</span>{canWrite && statementsApproved && <Link href={`/organizacion/filosofia?editValue=${item.id}#valores`} className="text-[14px] font-medium text-[#0e766f]">Editar</Link>}</div></div>
          <p className="mt-2 text-[15px] text-[#385463]">{item.behavior}</p>
          <p className="mt-2 text-[13px] text-[#6b828d]">Vínculo con misión: {item.mission_link || "—"} · vínculo con visión: {item.vision_link || "—"} · v{item.version}</p>
          {review && <div className="mt-3 rounded-lg bg-[#f3f7f7] p-3 text-[14px] text-[#4e6977]"><p className="font-semibold">{resolved?.origin === "legacy_group" ? "Revisión anterior del conjunto" : `Revisión del set: ${status}`}</p><p className="mt-1 whitespace-pre-wrap">{review.rationale}</p></div>}
          {priorReview?.status === "changes_requested" && <div className="mt-3 rounded-lg border border-[#e8cfaa] bg-[#fff8ea] p-3 text-[14px] text-[#754f22]"><p className="font-semibold">Observación del consultor sobre la versión anterior</p><p className="mt-1 whitespace-pre-wrap">{priorReview.rationale}</p><p className="mt-2 text-[13px]">La versión corregida está pendiente de una nueva revisión.</p></div>}
          {actor.role === "consultant" && statementsApproved && <form action={reviewValue} className="mt-5 space-y-3 border-t border-[#e1e9ea] pt-4"><input type="hidden" name="value_id" value={item.id} /><input type="hidden" name="expected_version" value={item.version} /><Label htmlFor={`value-rationale-${item.id}`}>Observación para {item.value_name}</Label><Textarea id={`value-rationale-${item.id}`} name="rationale" required minLength={10} maxLength={1500} className="min-h-20 bg-white text-[16px]" /><div className="flex flex-wrap gap-2"><Button type="submit" name="decision" value="approved">Aprobar este set</Button><Button type="submit" name="decision" value="changes_requested" variant="outline">Solicitar cambios en este set</Button></div></form>}
        </article>;
      })}</div>}
      {canWrite && statementsApproved && <form key={editValue?.id ?? "new-value"} action={saveValueBehavior} className="mt-6 grid gap-4 border-t border-[#e1e9ea] pt-6 sm:grid-cols-2">
        <input type="hidden" name="id" value={editValue?.id ?? ""} /><input type="hidden" name="expected_version" value={editValue?.version ?? 0} />
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="value-name">Valor</Label><Input id="value-name" name="value_name" defaultValue={editValue?.value_name ?? ""} required minLength={2} maxLength={120} className="h-11 bg-white text-[16px]" /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="behavior">Conducta verificable</Label><Textarea id="behavior" name="behavior" defaultValue={editValue?.behavior ?? ""} required minLength={10} maxLength={1500} className="min-h-24 bg-white text-[16px]" /></div>
        <div className="space-y-2"><Label htmlFor="mission-link">¿Cómo este valor ayuda a <strong className="font-bold text-[#0e766f]">CUMPLIR</strong> la misión?</Label><Textarea id="mission-link" name="mission_link" defaultValue={editValue?.mission_link ?? ""} maxLength={500} className="min-h-20 bg-white text-[16px]" /></div>
        <div className="space-y-2"><Label htmlFor="vision-link">¿Cómo este valor ayuda a <strong className="font-bold text-[#0e766f]">LOGRAR</strong> la visión?</Label><Textarea id="vision-link" name="vision_link" defaultValue={editValue?.vision_link ?? ""} maxLength={500} className="min-h-20 bg-white text-[16px]" /></div>
        <div className="sm:col-span-2"><p className="mb-3 text-[13px] text-[#6b828d]">Al guardar una corrección, solo este set queda pendiente de nueva revisión; los demás conservan su estado.</p><Button type="submit">{editValue ? "Guardar y reenviar este set a revisión" : "Añadir set para revisión"}</Button></div>
      </form>}
    </section>
    <div className="mt-7 flex justify-end"><Button asChild variant="outline"><Link href="/diagnostico">Ir al diagnóstico</Link></Button></div>
  </div></AppShell>;
}
