import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Building2, CircleCheck, LockKeyhole } from "lucide-react";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { canRead, getActor } from "@/lib/authz";
import { consultantReviewGate, factorIssues, latestValidations, quorum } from "@/lib/foda";
import { matrixVoteState } from "@/lib/foda-matrix";
import { modules, moduleHref } from "@/lib/modules";
import { diagnosticSubject, getDiagnosticInputs, latestApproval } from "@/lib/sprint2";
import { getConsultantFodaReview, getFodaEvidence, getFodaFactors, getFodaSet, getFodaValidations } from "@/lib/sprint3";
import { getMatrixReview, getMatrixVersions, getMatrixVotes } from "@/lib/sprint4";
import { getActionSet, getActionVotes, getMdep, getMdepVotes, latestGate } from "@/lib/sprint5";
import { bscCoverage, getObjectives } from "@/lib/sprint6";
import { getCurrentCycle, getMembers, getModuleProgress, getOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/"));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;

  const organization = await getOrganization();
  const cycle = organization ? await getCurrentCycle(organization.id) : null;
  const progress = cycle ? await getModuleProgress(cycle.id) : [];
  const progressByModule = new Map(progress.map((item) => [item.module_slug, item]));
  const completed = progress.filter((item) => item.status === "approved").length;
  const overall = Math.round(progress.reduce((sum, item) => sum + item.percent, 0) / modules.length);
  const firstModule = progressByModule.get("organizacion");
  let consultantFoda: ReturnType<typeof consultantReviewGate> | null = null;
  let consultantMatrix: { pending: boolean; ready: boolean; matrixId: string } | null = null;
  const fodaSet = cycle ? await getFodaSet(cycle.id) : null;
  const matrixVersions = fodaSet ? await getMatrixVersions(fodaSet.id) : [];
  const currentMatrix = matrixVersions.find((item) => item.set_version === fodaSet?.version);
  const actionSet = currentMatrix?.status === "approved" ? await getActionSet(currentMatrix.id) : null;
  const mdep = actionSet?.status === "approved" ? await getMdep(actionSet.id) : null;
  const objectives = mdep?.status === "approved" ? await getObjectives(mdep.id) : [];
  const objectiveCoverage = bscCoverage(objectives);
  let consultantStrategy: { title: string; href: string; ready: boolean } | null = null;
  if (actor.role === "consultant" && organization && cycle) {
    const set = fodaSet;
    if (set?.status === "draft") {
      const [factors, evidence, votes, members, review, diagnostic] = await Promise.all([
        getFodaFactors(set.id), getFodaEvidence(set.id), getFodaValidations(set), getMembers(organization.id),
        getConsultantFodaReview(set), getDiagnosticInputs(cycle.id),
      ]);
      const diagnosticApproved = (await latestApproval(cycle.id, "diagnostic.review", diagnosticSubject(diagnostic)))?.status === "approved";
      consultantFoda = consultantReviewGate({ setStatus: set.status, validation: quorum(latestValidations(votes), members),
        diagnosticApproved, issueCount: factorIssues(factors, evidence).length, reviewStatus: review?.status ?? null });
    }
    if (set?.status === "frozen" && currentMatrix?.status === "draft") {
      const [votes, members, review] = await Promise.all([
        getMatrixVotes(currentMatrix), getMembers(organization.id), getMatrixReview(cycle.id, currentMatrix),
      ]);
      const state = matrixVoteState(votes, members);
      consultantMatrix = { pending: !review, ready: state.ready, matrixId: currentMatrix.id };
    }
    if (actionSet?.status === "draft") {
      const votes = await getActionVotes(actionSet);
      const state = matrixVoteState(votes.map((v) => ({ ...v, matrix_id: v.action_set_id, matrix_revision: v.set_revision })), await getMembers(organization.id));
      const review = await latestGate(cycle.id, "strategy.actions", `${actionSet.id}:r${actionSet.revision}`);
      if (!review) consultantStrategy = { title: "Acciones y prioridades MDEP", href: "/modulos/formulacion", ready: state.ready };
    } else if (mdep?.status === "draft") {
      const votes = await getMdepVotes(mdep.id, mdep.revision);
      const state = matrixVoteState(votes.map((v) => ({ ...v, matrix_id: v.assessment_id, matrix_revision: v.assessment_revision, decision: "validated" as const })), await getMembers(organization.id));
      const review = await latestGate(cycle.id, "porter.mdep", `${mdep.id}:r${mdep.revision}`);
      if (!review) consultantStrategy = { title: "Dirección competitiva MDEP", href: "/modulos/porter", ready: state.ready };
    }
  }
  const nextTitle = fodaSet?.status === "frozen"
    ? currentMatrix?.status === "approved" ?
      actionSet?.status !== "approved" ? "Formular acciones estratégicas" : mdep?.status !== "approved" ? "Evaluar estrategia competitiva" : objectiveCoverage.count === 4 ? "Vincular iniciativas a objetivos" : "Definir objetivos estratégicos"
      : currentMatrix ? "Completar FODA cuantitativa" : "Iniciar FODA cuantitativa"
    : organization ? "Completar perfil y equipo" : "Crear el primer ciclo";
  const nextDescription = fodaSet?.status === "frozen"
    ? currentMatrix?.status === "approved" ? actionSet?.status !== "approved" ?
      "Vincula acciones FO, FA, DO y DA con factores y evidencias; priorízalas y obtén la revisión del equipo y consultor." :
      mdep?.status !== "approved" ? "Compara costes, diferenciación y enfoque con afinidad, viabilidad y condiciones verificables." :
      objectiveCoverage.count === 4 ? "Convierte los objetivos trazables en iniciativas con responsable y evidencia." :
      "La dirección competitiva quedó aprobada. Traduce la decisión en objetivos estratégicos." :
      "Califica FO y DA, interpreta FA y DO, analiza vulnerabilidad y registra la revisión del equipo y el consultor."
    : organization ? "Completa el encuadre y la filosofía empresarial; después registra antecedentes del diagnóstico con sus fuentes." :
      "Define la organización y el periodo de planificación. Después podrás asignar al Equipo de Alto Nivel.";

  return <AppShell active="home"><div className="mx-auto w-full max-w-[1320px] px-5 py-8 lg:px-9 lg:py-10">
    <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex items-start gap-5">
        <Image src="/brand/anima-praxis-cuadrado.png" alt="Logotipo cuadrado de Anima Praxis" width={1254} height={1254} priority unoptimized className="hidden size-32 shrink-0 rounded-2xl object-cover shadow-sm lg:block" />
        <div><p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5A626F]">{organization ? organization.name : "Ciclo estratégico"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#192538] sm:text-4xl">Mi plan estratégico</h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-6 text-[#5A626F]">{organization
          ? `Ciclo ${cycle?.name ?? "sin definir"}. Cada resultado conservará sus evidencias, cálculos y decisiones.`
          : "Empieza por registrar la organización. Cada etapa conservará sus evidencias, cálculos y decisiones."}</p></div>
      </div>
      {actor.role === "owner" && <Button asChild className="h-11 rounded-lg bg-[#192538] px-5 text-[14px] text-white hover:bg-[#344052]"><Link href={organization ? "/equipo" : "/organizacion"}>{organization ? "Gestionar equipo" : "Registrar organización"}</Link></Button>}
    </div>

    {consultantFoda?.pending && <section role="status" className="mb-8 rounded-2xl border border-[#D6A871] bg-[#FBF5EB] p-6" aria-labelledby="consultant-foda-title">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5A626F]">Bandeja del consultor · FODA base</p>
      <h2 id="consultant-foda-title" className="mt-2 text-xl font-semibold text-[#192538]">Duda registrada por el Equipo de Alto Nivel</h2>
      <p className="mt-2 text-sm leading-6 text-[#192538]">{consultantFoda.ready ? "La revisión está lista para tu decisión metodológica." : "La duda ya está visible. La aprobación se habilitará cuando el equipo complete:"}</p>
      {consultantFoda.blockers.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#192538]">{consultantFoda.blockers.map((item) => <li key={item}>{item}</li>)}</ul>}
      <Link href="/modulos/foda#revision-consultor" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#192538] underline underline-offset-2">Ver duda y revisión <ArrowUpRight className="size-4" /></Link>
    </section>}
    {consultantMatrix?.pending && <section role="status" className="mb-8 rounded-2xl border border-[#D6A871] bg-[#FBF5EB] p-6"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5A626F]">Bandeja del consultor · FODA cuantitativa</p><h2 className="mt-2 text-xl font-semibold text-[#192538]">Revisión de puntajes y prioridades</h2><p className="mt-2 text-sm text-[#192538]">{consultantMatrix.ready ? "El equipo alcanzó el quórum. Revisa el resultado y registra tu decisión." : "La matriz está en elaboración. Puedes revisar sus avances; la decisión se habilitará con el quórum."}</p><Link href={`/modulos/foda/matriz?matrix=${consultantMatrix.matrixId}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#192538] underline underline-offset-2">Ver matriz <ArrowUpRight className="size-4" /></Link></section>}
    {consultantStrategy && <section role="status" className="mb-8 rounded-2xl border border-[#D6A871] bg-[#FBF5EB] p-6"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#5A626F]">Bandeja del consultor · Sprint 5</p><h2 className="mt-2 text-xl font-semibold text-[#192538]">{consultantStrategy.title}</h2><p className="mt-2 text-sm">{consultantStrategy.ready ? "El equipo alcanzó el quórum. Comprueba fuentes, notas y condiciones para registrar tu revisión." : "El equipo está completando su deliberación. Puedes revisar los avances."}</p><Link href={consultantStrategy.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#192538] underline">Abrir revisión <ArrowUpRight className="size-4" /></Link></section>}

    <div className="mb-8 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-6 shadow-[0_8px_30px_rgba(14,41,58,0.04)]" aria-labelledby="progress-title">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[13px] font-medium text-[#5A626F]">Avance del ciclo</p><h2 id="progress-title" className="mt-1 text-xl font-semibold text-[#192538]">{organization ? "Plan en construcción" : "Organización pendiente"}</h2></div><span className="text-3xl font-semibold text-[#192538]">{overall}%</span></div>
        <Progress value={overall} className="mt-6 h-2 bg-[#EEE8DF]" /><p className="mt-4 text-[14px] text-[#5A626F]">El porcentaje refleja captura y aprobaciones, no la calidad de la estrategia.</p>
      </section>
      <section className="rounded-2xl border border-[#E6C99F] bg-[#fbf5eb] p-6" aria-labelledby="next-title">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A626F]">Siguiente paso</p><h2 id="next-title" className="mt-2 text-xl font-semibold text-[#192538]">{nextTitle}</h2>
        <p className="mt-2 text-[14px] leading-6 text-[#5A626F]">{nextDescription}</p>
        {fodaSet?.status === "frozen" && currentMatrix?.status !== "approved" && <Link href="/modulos/foda/matriz" className="mt-3 inline-block text-sm font-semibold text-[#192538] underline underline-offset-2">Abrir matriz</Link>}
        {currentMatrix?.status === "approved" && actionSet?.status !== "approved" && <Link href="/modulos/formulacion" className="mt-3 inline-block text-sm font-semibold text-[#192538] underline underline-offset-2">Abrir formulación</Link>}
        {actionSet?.status === "approved" && mdep?.status !== "approved" && <Link href="/modulos/porter" className="mt-3 inline-block text-sm font-semibold text-[#192538] underline underline-offset-2">Abrir MDEP</Link>}
        {mdep?.status === "approved" && <Link href={objectiveCoverage.count === 4 ? "/modulos/iniciativas" : "/modulos/objetivos"} className="mt-3 inline-block text-sm font-semibold text-[#192538] underline underline-offset-2">{objectiveCoverage.count === 4 ? "Abrir iniciativas" : "Abrir objetivos"}</Link>}
      </section>
    </div>

    <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#192538]">Etapas del plan</h2><p className="mt-1 text-[14px] text-[#5A626F]">14 módulos conectados; las etapas se habilitan según sus dependencias.</p></div><span className="hidden text-[13px] font-medium text-[#5A626F] sm:block">{completed} de 14 completados</span></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map((item, index) => {
      const state = progressByModule.get(item.slug);
      const label = state?.status === "approved" ? "Aprobado" : state?.status === "in_progress" ? "En curso" : "Pendiente";
      return <Link href={moduleHref(item.slug)} key={item.slug} className="group flex min-h-[138px] flex-col justify-between rounded-xl border border-[#E6DFD6] bg-white p-5 transition-colors hover:border-[#E6C99F] hover:bg-[#FAF8F4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#192538]">
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-[#FBF5EB] text-[#192538]">{index === 0 ? <Building2 className="size-5" /> : <span className="text-sm font-semibold">{item.number}</span>}</span><span className="text-[13px] font-semibold text-[#5A626F]">{item.phase}</span></div><ArrowUpRight className="size-4 text-[#D6A871] group-hover:text-[#192538]" /></div>
        <div><h3 className="text-[16px] font-semibold text-[#192538] group-hover:text-[#192538]">{item.title}</h3><p className="mt-1 text-[13px] text-[#5A626F]">{label} · {state?.percent ?? 0}%</p></div>
      </Link>;
    })}</div>
    <div className="mt-6 flex flex-wrap gap-4 text-[13px] text-[#5A626F]"><span className="flex items-center gap-1.5"><CircleCheck className="size-4" /> Resultados sujetos a revisión humana</span><span className="flex items-center gap-1.5"><LockKeyhole className="size-4" /> Acceso privado</span>{firstModule?.summary && <span>{firstModule.summary}</span>}</div>
  </div></AppShell>;
}
