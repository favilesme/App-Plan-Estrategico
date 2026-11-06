import { decideSprint7, reviewSprint7, voteSprint7 } from "@/app/sprint7-review-actions";
import type { getSprint7ReviewState } from "@/lib/sprint7-review";
import type { Member } from "@/lib/workspace";

type State = Awaited<ReturnType<typeof getSprint7ReviewState>>;
const input = "mt-1 w-full rounded-lg border border-[#C9C5BF] bg-white px-3 py-2 text-sm text-[#192538]";
const button = "rounded-lg bg-[#192538] px-4 py-2 text-sm font-semibold text-white hover:bg-[#344052] disabled:cursor-not-allowed disabled:opacity-50";

function editorName(userId: string, members: Member[]) {
  return members.find((member) => member.auth_user_id === userId)?.display_name || "Integrante identificado en auditoría";
}

function label(status: string) {
  return status === "validated" ? "Validado para demostración" : status === "doubt" ? "Duda" :
    status === "approved" ? "Favorable" : "Cambios solicitados";
}

export function Sprint7ReviewPanel({ state, members, actorRole, actorMemberId }: {
  state: State; members: Member[]; actorRole: string; actorMemberId: string | null;
}) {
  const member = members.find((item) => item.id === actorMemberId && item.status === "active");
  const canVote = Boolean(member?.is_leader && ["owner", "admin", "leader"].includes(member.role));
  const canDecide = Boolean(canVote && member?.is_director);
  const alreadyVoted = state.votes.current.some((vote) => vote.reviewer_user_id === member?.auth_user_id);
  return <section id="revision-sprint7" className="rounded-2xl border border-[#D6A871] bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-widest text-[#5A626F]">Sprint 7 · Control del piloto comercial</p>
    <h2 className="mt-2 text-lg font-semibold">Confirmación y aprobación del conjunto de demostración</h2>
    <p className="mt-2 text-sm text-[#5A626F]">Este conjunto contiene datos ficticios definitivos para presentar la aplicación. La decisión confirma su coherencia como demostración; no acredita resultados ni compromisos de un cliente real. Cada participación queda ligada a las versiones visibles de los seis planes, 84 importes, cinco KPI y tres CMI de área.</p>
    {state.approved ? <p role="status" className="mt-3 rounded-lg bg-[#EAF3EC] p-3 text-sm font-semibold text-[#31523B]">Conjunto ficticio aprobado para demostración comercial. Versiones fijadas y módulos del Sprint 7 cerrados.</p>
      : <p className="mt-3 text-sm"><strong>Participación vigente:</strong> {state.votes.count}/3 · director {state.votes.hasDirector ? "incluido" : "pendiente"} · {state.votes.ready ? "quórum alcanzado" : "quórum pendiente"}. {state.blockers.length ? "El conjunto aún tiene bloqueos de formato o trazabilidad." : "Conjunto completo para confirmación humana."}</p>}
    {state.blockers.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#7E3527]">{state.blockers.map((item) => <li key={item}>{item}</li>)}</ul>}
    {state.votes.hasChangesRequested && <p className="mt-3 text-sm text-[#7E3527]">Se solicitaron cambios. Una edición crea versiones nuevas y abre otra ronda de participación.</p>}
    {state.votes.current.length > 0 && <div className="mt-4 space-y-2"><h3 className="text-sm font-semibold">Participaciones del equipo</h3>
      {state.votes.current.map((vote) => <p key={vote.id} className="rounded-lg bg-[#FAF8F4] p-3 text-sm"><strong>{editorName(vote.reviewer_user_id, members)}</strong> · {label(vote.status)} · {vote.created_at}<span className="mt-1 block whitespace-pre-wrap text-[#5A626F]">{vote.rationale}</span></p>)}</div>}
    {canVote && alreadyVoted && !state.approved && <p className="mt-3 text-sm text-[#5A626F]">Tu participación ya está registrada para estas versiones.</p>}
    {canVote && !alreadyVoted && state.readyForVote && <form action={voteSprint7} className="mt-5 space-y-3 border-t border-[#E6DFD6] pt-4">
      <input type="hidden" name="expected_subject" value={state.subject}/><h3 className="font-semibold">Participación del Equipo de Alto Nivel</h3>
      <label className="block text-sm">Fundamento de tu valoración<textarea name="rationale" required minLength={10} maxLength={1500} className={input}/></label>
      <div className="flex flex-wrap gap-2"><button className={button} name="decision" value="validated">Validar para demostración</button>
        <button className={button} name="decision" value="doubt">Registrar duda</button>
        <button className={button} name="decision" value="changes_requested">Solicitar cambios</button></div>
    </form>}
    {state.review && <div className="mt-4 rounded-lg bg-[#FAF8F4] p-3 text-sm"><strong>Revisión del consultor:</strong> {label(state.review.status)} · {editorName(state.review.reviewer_user_id, members)} · {state.review.created_at}<p className="mt-1 whitespace-pre-wrap text-[#5A626F]">{state.review.rationale}</p></div>}
    {actorRole === "consultant" && !state.approved && !state.reviewRecorded && <form action={reviewSprint7} className="mt-5 space-y-3 border-t border-[#E6DFD6] pt-4">
      <input type="hidden" name="expected_subject" value={state.subject}/><h3 className="font-semibold">Revisión metodológica del consultor</h3>
      <p className="text-sm text-[#5A626F]">{state.readyForReview ? "El quórum está completo. Revisa coherencia, origen ficticio visible y versiones antes de decidir." : "Se habilitará cuando el equipo complete el quórum y no existan bloqueos."}</p>
      <label className="block text-sm">Fundamento y observaciones<textarea name="rationale" required minLength={10} maxLength={1500} className={input}/></label>
      <div className="flex flex-wrap gap-2"><button className={button} name="decision" value="approved" disabled={!state.readyForReview}>Revisión favorable</button>
        <button className={button} name="decision" value="changes_requested" disabled={!state.readyForReview}>Solicitar cambios</button></div>
    </form>}
    {canDecide && !state.approved && <form action={decideSprint7} className="mt-5 space-y-3 border-t border-[#E6DFD6] pt-4">
      <input type="hidden" name="expected_subject" value={state.subject}/><h3 className="font-semibold">Decisión final del director</h3>
      <p className="text-sm text-[#5A626F]">{state.readyForFinal ? "La revisión favorable del consultor corresponde a estas versiones." : "Se habilitará tras la participación del equipo y revisión favorable del consultor."}</p>
      <label className="block text-sm">Fundamento de la decisión<textarea name="rationale" required minLength={20} maxLength={2000} className={input}/></label>
      <div className="flex flex-wrap gap-2"><button className={button} name="decision" value="approved" disabled={!state.readyForFinal}>Aprobar para demostración comercial</button>
        <button className={button} name="decision" value="changes_requested" disabled={!state.readyForFinal}>Solicitar cambios</button></div>
    </form>}
    {state.final && <p className="mt-4 rounded-lg bg-[#EAF3EC] p-3 text-sm"><strong>Decisión del director:</strong> {state.final.status === "approved" ? "aprobado para demostración" : "cambios solicitados"} · {editorName(state.final.reviewer_user_id, members)} · {state.final.created_at}. {state.final.rationale}</p>}
    {state.reviewRecorded && state.review?.status === "changes_requested" && <p className="mt-3 text-sm text-[#7E3527]">La revisión pidió cambios. Edita un borrador para crear nuevas versiones y reiniciar la ronda.</p>}
    {state.final?.status === "changes_requested" && <p className="mt-3 text-sm text-[#7E3527]">La dirección pidió cambios. Edita un borrador para crear nuevas versiones y reiniciar la ronda.</p>}
  </section>;
}
