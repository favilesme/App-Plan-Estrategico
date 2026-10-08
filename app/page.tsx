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
import { modules, moduleHref } from "@/lib/modules";
import { getCurrentCycle, getModuleProgress, getOrganization } from "@/lib/workspace";

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

    <div className="mb-8 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-6 shadow-[0_8px_30px_rgba(14,41,58,0.04)]" aria-labelledby="progress-title">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[13px] font-medium text-[#5A626F]">Avance del ciclo</p><h2 id="progress-title" className="mt-1 text-xl font-semibold text-[#192538]">{organization ? "Plan en construcción" : "Organización pendiente"}</h2></div><span className="text-3xl font-semibold text-[#192538]">{overall}%</span></div>
        <Progress value={overall} className="mt-6 h-2 bg-[#EEE8DF]" /><p className="mt-4 text-[14px] text-[#5A626F]">El porcentaje refleja captura y aprobaciones, no la calidad de la estrategia.</p>
      </section>
      <section className="rounded-2xl border border-[#E6C99F] bg-[#fbf5eb] p-6" aria-labelledby="next-title">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5A626F]">Siguiente paso</p><h2 id="next-title" className="mt-2 text-xl font-semibold text-[#192538]">{organization ? "Completar perfil y equipo" : "Crear el primer ciclo"}</h2>
        <p className="mt-2 text-[14px] leading-6 text-[#5A626F]">{organization ? "Completa el encuadre y la filosofía empresarial; después registra antecedentes del diagnóstico con sus fuentes." : "Define la organización y el periodo de planificación. Después podrás asignar al Equipo de Alto Nivel."}</p>
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
