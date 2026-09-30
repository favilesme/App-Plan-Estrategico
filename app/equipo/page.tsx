import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, UsersRound } from "lucide-react";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { MemberForm } from "@/components/member-form";
import { canManageTeam, canRead, getActor } from "@/lib/authz";
import { MAX_HIGH_LEVEL_LEADERS, MIN_VALIDATION_QUORUM } from "@/lib/methodology";
import { getMembers, getOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  permission: "Tu rol no permite cambiar este integrante.", invalid: "Revisa los datos y facultades seleccionadas.",
  duplicate: "Ese correo ya consta en el equipo.", limit: "El Equipo de Alto Nivel admite un máximo de cinco líderes activos.",
  director: "Ya hay un gerente general o máximo director activo.", missing: "No se encontró al integrante.",
};
const roles: Record<string, string> = { owner: "Propietario", admin: "Administrador del equipo", leader: "Líder de opinión", consultant: "Consultor", observer: "Observador" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/equipo"));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  const organization = await getOrganization();
  const params = await searchParams;
  if (!organization) return <AppShell active="equipo"><div className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-9"><h1 className="text-2xl font-semibold">Equipo de Alto Nivel</h1><p className="mt-3 text-[16px] text-[#597180]">Primero registra la organización y el ciclo.</p><Link href="/organizacion" className="mt-5 inline-block font-medium text-[#0e766f]">Ir a información de la empresa</Link></div></AppShell>;
  const members = await getMembers(organization.id);
  const leaders = members.filter((m) => m.is_leader && m.status === "active");
  const directorPresent = leaders.some((m) => m.is_director);
  const quorumReady = leaders.length >= MIN_VALIDATION_QUORUM && directorPresent;
  const error = params.error ? errors[params.error] : null;

  return <AppShell active="equipo"><div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#47746f] hover:text-[#0e766f]"><ArrowLeft className="size-4" /> Volver al plan</Link>
    <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#287c78]">Gobierno del proceso</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#102b3f]">Equipo de Alto Nivel</h1><p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#597180]">Hasta cinco líderes de opinión canalizan los aportes de sus equipos. Cada validación registra quién participó.</p></div><span className="w-fit rounded-full border border-[#cae1dd] bg-[#eaf6f3] px-3 py-1.5 text-[14px] font-semibold text-[#256c68]">{leaders.length} / {MAX_HIGH_LEVEL_LEADERS} líderes</span></div>
    {error && <p role="alert" className="mt-6 rounded-xl border border-[#e5bcbc] bg-[#fff4f2] p-4 text-[14px] text-[#9d3737]">{error}</p>}
    {params.saved && <p role="status" className="mt-6 rounded-xl border border-[#b9dcd4] bg-[#eaf8f4] p-4 text-[14px] text-[#286a61]">Integrante guardado en esta instancia.</p>}
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.78fr]">
      <section className="rounded-2xl border border-[#dbe5e7] bg-white p-6">
        <div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-[#e9f4f3] text-[#0e766f]"><UsersRound className="size-5" /></span><div><h2 className="text-xl font-semibold text-[#102b3f]">Integrantes registrados</h2><p className="mt-1 text-[14px] text-[#687f89]">Un rol interno no concede acceso al Site; el propietario debe compartirlo por separado.</p></div></div>
        <div className="mt-6 divide-y divide-[#e6eded]">{members.map((m) => {
          const editable = canManageTeam(actor.role) && m.role !== "owner" && (actor.role === "owner" || (m.role !== "admin" && m.role !== "consultant" && !m.is_director));
          return <div key={m.id} className="flex items-start justify-between gap-3 py-4"><div><p className="text-[15px] font-semibold text-[#19384a]">{m.display_name}</p><p className="mt-0.5 text-[14px] text-[#718792]">{m.email}</p><div className="mt-2 flex flex-wrap gap-2 text-[12px]"><span className="rounded-full bg-[#edf4f5] px-2.5 py-1 text-[#436773]">{roles[m.role] ?? m.role}</span>{Boolean(m.is_leader) && <span className="rounded-full bg-[#e3f4f0] px-2.5 py-1 text-[#206e65]">Equipo de Alto Nivel</span>}{Boolean(m.is_director) && <span className="rounded-full bg-[#f6f0df] px-2.5 py-1 text-[#806123]">Dirección</span>}{m.status !== "active" && <span className="rounded-full bg-[#f3eeee] px-2.5 py-1 text-[#8e6262]">Inactivo</span>}</div></div>{editable && <Link href={`/equipo/${m.id}`} className="shrink-0 text-[14px] font-medium text-[#0e766f] hover:underline">Editar</Link>}</div>;
        })}</div>
      </section>
      <div className="space-y-5"><section className="rounded-2xl border border-[#c9e2de] bg-[#eaf6f3] p-6"><ShieldCheck className="size-6 text-[#0e766f]" /><h2 className="mt-3 text-lg font-semibold text-[#143b47]">Quórum de validación</h2><p className="mt-2 text-[14px] leading-6 text-[#4a6872]">{quorumReady ? "Equipo configurado para futuras validaciones." : `Pendiente: se necesitan al menos ${MIN_VALIDATION_QUORUM} líderes activos y el gerente general o máximo director.`}</p><p className="mt-3 text-[13px] text-[#5f7d85]">Los votos y aprobaciones se implementarán con cada etapa metodológica.</p></section>
        {canManageTeam(actor.role) && <section className="rounded-2xl border border-[#dbe5e7] bg-white p-6"><h2 className="text-xl font-semibold text-[#102b3f]">Agregar integrante</h2><p className="mt-2 text-[14px] leading-6 text-[#687f89]">Registrar a una persona aquí no le envía una invitación ni le abre el Site.</p><div className="mt-6"><MemberForm actorRole={actor.role} /></div></section>}
      </div>
    </div>
  </div></AppShell>;
}
