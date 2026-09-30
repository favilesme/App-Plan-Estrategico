import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, CircleCheck, UsersRound } from "lucide-react";
import { createOrganization } from "@/app/actions";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canRead, getActor } from "@/lib/authz";
import { getCurrentCycle, getOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  invalid: "Revisa el nombre, el periodo y las fechas del ciclo.",
  exists: "Ya existe una organización en esta instancia privada.",
  permission: "Tu rol no permite crear la organización.",
};

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/organizacion"));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const organization = await getOrganization();
  const cycle = organization ? await getCurrentCycle(organization.id) : null;
  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;

  return <AppShell active="organizacion"><div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#47746f] hover:text-[#0e766f]"><ArrowLeft className="size-4" /> Volver al plan</Link>
    <div className="mt-6"><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#287c78]">Módulo 01</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102b3f]">Información de la empresa</h1><p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#597180]">El encuadre define a qué organización, equipo y periodo pertenecerán todas las evidencias y decisiones del plan.</p></div>
    {error && <p role="alert" className="mt-6 rounded-xl border border-[#e5bcbc] bg-[#fff4f2] p-4 text-[14px] text-[#9d3737]">{error}</p>}
    {params.created && <p role="status" className="mt-6 flex items-center gap-2 rounded-xl border border-[#b9dcd4] bg-[#eaf8f4] p-4 text-[14px] text-[#286a61]"><CircleCheck className="size-5" /> Organización y ciclo guardados.</p>}
    {organization ? <div className="mt-8 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <section className="rounded-2xl border border-[#dbe5e7] bg-white p-6"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-[#e9f4f3] text-[#0e766f]"><Building2 className="size-5" /></span><div><p className="text-[13px] text-[#6b828d]">Organización registrada</p><h2 className="text-xl font-semibold text-[#102b3f]">{organization.name}</h2></div></div><dl className="mt-6 grid gap-4 border-t border-[#e3ebec] pt-6 sm:grid-cols-2"><div><dt className="text-[13px] text-[#6b828d]">Sector</dt><dd className="mt-1 text-[15px] font-medium text-[#19384a]">{organization.sector || "Pendiente"}</dd></div><div><dt className="text-[13px] text-[#6b828d]">Ciclo</dt><dd className="mt-1 text-[15px] font-medium text-[#19384a]">{cycle?.name ?? "Pendiente"}</dd></div><div><dt className="text-[13px] text-[#6b828d]">Periodo</dt><dd className="mt-1 text-[15px] font-medium text-[#19384a]">{cycle ? `${cycle.start_date} a ${cycle.end_date}` : "Pendiente"}</dd></div><div><dt className="text-[13px] text-[#6b828d]">Versión metodológica</dt><dd className="mt-1 text-[15px] font-medium text-[#19384a]">{cycle?.methodology_version ?? "Pendiente"}</dd></div></dl></section>
      <section className="rounded-2xl border border-[#c9e2de] bg-[#eaf6f3] p-6"><UsersRound className="size-7 text-[#0e766f]" /><h2 className="mt-4 text-xl font-semibold text-[#143b47]">Equipo de Alto Nivel</h2><p className="mt-2 text-[14px] leading-6 text-[#4a6872]">Designa hasta cinco líderes de opinión. El gerente general o máximo director debe participar en las validaciones.</p><Button asChild className="mt-5 h-10"><Link href="/equipo">Gestionar equipo</Link></Button></section>
    </div> : actor.role === "owner" ? <section className="mt-8 rounded-2xl border border-[#dbe5e7] bg-white p-6 lg:p-8">
      <h2 className="text-xl font-semibold text-[#102b3f]">Crear organización y ciclo</h2><p className="mt-2 text-[14px] text-[#667c89]">Usa únicamente datos ficticios en este piloto.</p>
      <form action={createOrganization} className="mt-7 grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="org-name">Nombre de la organización</Label><Input id="org-name" name="name" required minLength={2} maxLength={120} className="h-11 bg-white text-[16px]" /></div><div className="space-y-2"><Label htmlFor="org-sector">Sector o actividad</Label><Input id="org-sector" name="sector" maxLength={120} className="h-11 bg-white text-[16px]" /></div></div>
        <div className="space-y-2"><Label htmlFor="cycle-name">Nombre del ciclo estratégico</Label><Input id="cycle-name" name="cycle_name" required minLength={2} maxLength={100} className="h-11 bg-white text-[16px]" /></div>
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="start-date">Inicio del ciclo</Label><Input id="start-date" name="start_date" type="date" required className="h-11 bg-white text-[16px]" /></div><div className="space-y-2"><Label htmlFor="end-date">Fin del ciclo</Label><Input id="end-date" name="end_date" type="date" required className="h-11 bg-white text-[16px]" /></div></div>
        <div className="flex items-start gap-3 rounded-xl border border-[#dce8e7] bg-[#f6faf9] p-4"><Checkbox id="owner-director" name="owner_is_director" className="mt-1" /><div><Label htmlFor="owner-director" className="text-[14px]">También soy el gerente general o máximo director</Label><p className="mt-1 text-[13px] leading-5 text-[#66808b]">Si lo marcas, contarás como integrante del Equipo de Alto Nivel. Si no, podrás designar a otra persona.</p></div></div>
        <div className="flex justify-end"><Button type="submit" className="h-11 rounded-lg px-6">Guardar y continuar</Button></div>
      </form>
    </section> : <p className="mt-8 rounded-xl border border-[#dbe5e7] bg-white p-6 text-[15px] text-[#597180]">El propietario debe crear la organización antes de continuar.</p>}
  </div></AppShell>;
}
