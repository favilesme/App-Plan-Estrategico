import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, CircleCheck, UsersRound } from "lucide-react";
import { createOrganization } from "@/app/actions";
import { saveProjectProfile } from "@/app/sprint2-actions";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canRead, getActor } from "@/lib/authz";
import { getCurrentCycle, getOrganization } from "@/lib/workspace";
import { getProjectProfile } from "@/lib/sprint2";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  invalid: "Revisa el nombre, el periodo y las fechas del ciclo.",
  exists: "Ya existe una organización en esta instancia privada.",
  permission: "Tu rol no permite crear la organización.",
};

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; saved?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/organizacion"));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const organization = await getOrganization();
  const cycle = organization ? await getCurrentCycle(organization.id) : null;
  const profile = cycle ? await getProjectProfile(cycle.id) : null;
  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;

  return <AppShell active="organizacion"><div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#192538] hover:text-[#192538]"><ArrowLeft className="size-4" /> Volver al plan</Link>
    <div className="mt-6"><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#192538]">Módulo 01</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#192538]">Información de la empresa</h1><p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#5A626F]">El encuadre define a qué organización, equipo y periodo pertenecerán todas las evidencias y decisiones del plan.</p></div>
    {error && <p role="alert" className="mt-6 rounded-xl border border-[#e5bcbc] bg-[#fff4f2] p-4 text-[14px] text-[#9d3737]">{error}</p>}
    {(params.created || params.saved) && <p role="status" className="mt-6 flex items-center gap-2 rounded-xl border border-[#E6C99F] bg-[#eaf8f4] p-4 text-[14px] text-[#286a61]"><CircleCheck className="size-5" /> Información guardada.</p>}
    {organization ? <div className="mt-8 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-6"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-[#FBF5EB] text-[#192538]"><Building2 className="size-5" /></span><div><p className="text-[13px] text-[#5A626F]">Organización registrada</p><h2 className="text-xl font-semibold text-[#192538]">{organization.name}</h2></div></div><dl className="mt-6 grid gap-4 border-t border-[#E6DFD6] pt-6 sm:grid-cols-2"><div><dt className="text-[13px] text-[#5A626F]">Sector</dt><dd className="mt-1 text-[15px] font-medium text-[#192538]">{organization.sector || "Pendiente"}</dd></div><div><dt className="text-[13px] text-[#5A626F]">Ciclo</dt><dd className="mt-1 text-[15px] font-medium text-[#192538]">{cycle?.name ?? "Pendiente"}</dd></div><div><dt className="text-[13px] text-[#5A626F]">Periodo</dt><dd className="mt-1 text-[15px] font-medium text-[#192538]">{cycle ? `${cycle.start_date} a ${cycle.end_date}` : "Pendiente"}</dd></div><div><dt className="text-[13px] text-[#5A626F]">Versión metodológica</dt><dd className="mt-1 text-[15px] font-medium text-[#192538]">{cycle?.methodology_version ?? "Pendiente"}</dd></div></dl></section>
      <section className="rounded-2xl border border-[#E6C99F] bg-[#FBF5EB] p-6"><UsersRound className="size-7 text-[#192538]" /><h2 className="mt-4 text-xl font-semibold text-[#192538]">Equipo de Alto Nivel</h2><p className="mt-2 text-[14px] leading-6 text-[#5A626F]">Designa hasta cinco líderes de opinión. El gerente general o máximo director debe participar en las validaciones.</p><Button asChild className="mt-5 h-10"><Link href="/equipo">Gestionar equipo</Link></Button></section>
      {cycle && <section className="rounded-2xl border border-[#E6DFD6] bg-white p-6 lg:col-span-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#192538]">Encuadre</p>
        <h2 className="mt-2 text-xl font-semibold text-[#192538]">Alcance, calendario y fuentes</h2>
        <p className="mt-2 text-[14px] leading-6 text-[#5A626F]">Registra el acuerdo de trabajo y qué información se solicitará. No incluyas datos que aún no estén confirmados; utiliza [FALTA] cuando corresponda.</p>
        <form action={saveProjectProfile} className="mt-6 grid gap-5 sm:grid-cols-2">
          {([["scope", "Alcance del proyecto", "¿Qué unidades, mercados y decisiones cubre este ciclo?", profile?.scope], ["calendar_notes", "Calendario de trabajo", "Talleres, hitos y responsables acordados.", profile?.calendar_notes], ["primary_sources", "Fuentes primarias", "Entrevistas, talleres y aportes directos previstos.", profile?.primary_sources], ["secondary_sources", "Fuentes secundarias", "Documentos, reportes e información histórica prevista.", profile?.secondary_sources]] as const).map(([name, label, hint, current]) => <div className="space-y-2" key={name}><Label htmlFor={name}>{label}</Label><p className="text-[13px] text-[#5A626F]">{hint}</p><Textarea id={name} name={name} defaultValue={current ?? ""} maxLength={3000} readOnly={actor.role !== "owner" && actor.role !== "consultant"} className="min-h-24 bg-white text-[16px]" /></div>)}
          {(actor.role === "owner" || actor.role === "consultant") && <div className="sm:col-span-2"><Button type="submit">Guardar encuadre</Button></div>}
        </form>
      </section>}
      <section className="rounded-2xl border border-[#E6C99F] bg-[#FBF5EB] p-6 lg:col-span-2"><h2 className="text-xl font-semibold text-[#192538]">Filosofía empresarial</h2><p className="mt-2 text-[14px] text-[#5A626F]">El Equipo de Alto Nivel responde las preguntas de misión y visión; después formula valores con conductas observables. El consultor revisa los resultados.</p><Button asChild className="mt-4"><Link href="/organizacion/filosofia">Continuar filosofía</Link></Button></section>
    </div> : actor.role === "owner" ? <section className="mt-8 rounded-2xl border border-[#E6DFD6] bg-white p-6 lg:p-8">
      <h2 className="text-xl font-semibold text-[#192538]">Crear organización y ciclo</h2><p className="mt-2 text-[14px] text-[#5A626F]">Usa únicamente datos ficticios en este piloto.</p>
      <form action={createOrganization} className="mt-7 grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="org-name">Nombre de la organización</Label><Input id="org-name" name="name" required minLength={2} maxLength={120} className="h-11 bg-white text-[16px]" /></div><div className="space-y-2"><Label htmlFor="org-sector">Sector o actividad</Label><Input id="org-sector" name="sector" maxLength={120} className="h-11 bg-white text-[16px]" /></div></div>
        <div className="space-y-2"><Label htmlFor="cycle-name">Nombre del ciclo estratégico</Label><Input id="cycle-name" name="cycle_name" required minLength={2} maxLength={100} className="h-11 bg-white text-[16px]" /></div>
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="start-date">Inicio del ciclo</Label><Input id="start-date" name="start_date" type="date" required className="h-11 bg-white text-[16px]" /></div><div className="space-y-2"><Label htmlFor="end-date">Fin del ciclo</Label><Input id="end-date" name="end_date" type="date" required className="h-11 bg-white text-[16px]" /></div></div>
        <div className="flex items-start gap-3 rounded-xl border border-[#E6DFD6] bg-[#FAF8F4] p-4"><Checkbox id="owner-director" name="owner_is_director" className="mt-1" /><div><Label htmlFor="owner-director" className="text-[14px]">También soy el gerente general o máximo director</Label><p className="mt-1 text-[13px] leading-5 text-[#5A626F]">Si lo marcas, contarás como integrante del Equipo de Alto Nivel. Si no, podrás designar a otra persona.</p></div></div>
        <div className="flex justify-end"><Button type="submit" className="h-11 rounded-lg px-6">Guardar y continuar</Button></div>
      </form>
    </section> : <p className="mt-8 rounded-xl border border-[#E6DFD6] bg-white p-6 text-[15px] text-[#5A626F]">El propietario debe crear la organización antes de continuar.</p>}
  </div></AppShell>;
}
