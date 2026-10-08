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
  if (!organization) return <AppShell active="equipo"><div className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-9"><h1 className="text-2xl font-semibold">Equipo de Alto Nivel</h1><p className="mt-3 text-[16px] text-[#5A626F]">Primero registra la organización y el ciclo.</p><Link href="/organizacion" className="mt-5 inline-block font-medium text-[#192538]">Ir a información de la empresa</Link></div></AppShell>;
  const members = await getMembers(organization.id);
  const leaders = members.filter((m) => m.is_leader && m.status === "active" && ["owner", "admin", "leader"].includes(m.role));
  const directorPresent = leaders.some((m) => m.is_director);
  const quorumReady = leaders.length >= MIN_VALIDATION_QUORUM && directorPresent;
  const error = params.error ? errors[params.error] : null;

  return <AppShell active="equipo"><div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-9 lg:py-10">
    <Link href="/" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#192538] hover:text-[#192538]"><ArrowLeft className="size-4" /> Volver al plan</Link>
    <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#192538]">Gobierno del proceso</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#192538]">Equipo de Alto Nivel</h1><p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#5A626F]">Hasta cinco líderes de opinión canalizan los aportes de sus equipos. Cada validación registra quién participó.</p></div><span className="w-fit rounded-full border border-[#E6C99F] bg-[#FBF5EB] px-3 py-1.5 text-[14px] font-semibold text-[#192538]">{leaders.length} / {MAX_HIGH_LEVEL_LEADERS} líderes</span></div>
    {error && <p role="alert" className="mt-6 rounded-xl border border-[#e5bcbc] bg-[#fff4f2] p-4 text-[14px] text-[#9d3737]">{error}</p>}
    {params.saved && <p role="status" className="mt-6 rounded-xl border border-[#E6C99F] bg-[#eaf8f4] p-4 text-[14px] text-[#286a61]">Integrante guardado en esta instancia.</p>}
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.78fr]">
      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-6">
        <div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-[#FBF5EB] text-[#192538]"><UsersRound className="size-5" /></span><div><h2 className="text-xl font-semibold text-[#192538]">Integrantes registrados</h2><p className="mt-1 text-[14px] text-[#5A626F]">Un rol interno no concede acceso al Site; el propietario debe compartirlo por separado.</p></div></div>
        <div className="mt-6 divide-y divide-[#E6DFD6]">{members.map((m) => {
          const editable = canManageTeam(actor.role) && m.role !== "owner" && (actor.role === "owner" || (m.role !== "admin" && m.role !== "consultant" && !m.is_director));
          const eligibleLeader = ["owner", "admin", "leader"].includes(m.role);
          return <div key={m.id} className="flex items-start justify-between gap-3 py-4"><div><p className="text-[15px] font-semibold text-[#192538]">{m.display_name}</p><p className="mt-0.5 text-[14px] text-[#5A626F]">{m.email}</p><div className="mt-2 flex flex-wrap gap-2 text-[12px]"><span className="rounded-full bg-[#EEE8DF] px-2.5 py-1 text-[#192538]">{roles[m.role] ?? m.role}</span>{Boolean(m.is_leader) && eligibleLeader && <span className="rounded-full bg-[#FBF5EB] px-2.5 py-1 text-[#206e65]">Equipo de Alto Nivel</span>}{Boolean(m.is_director) && <span className="rounded-full bg-[#f6f0df] px-2.5 py-1 text-[#806123]">Dirección</span>}{m.status !== "active" && <span className="rounded-full bg-[#f3eeee] px-2.5 py-1 text-[#8e6262]">Inactivo</span>}</div></div>{editable && <Link href={`/equipo/${m.id}`} className="shrink-0 text-[14px] font-medium text-[#192538] hover:underline">Editar</Link>}</div>;
        })}</div>
      </section>
      <div className="space-y-5"><section className="rounded-2xl border border-[#E6C99F] bg-[#FBF5EB] p-6"><ShieldCheck className="size-6 text-[#192538]" /><h2 className="mt-3 text-lg font-semibold text-[#192538]">Quórum de validación</h2><p className="mt-2 text-[14px] leading-6 text-[#5A626F]">{quorumReady ? "Equipo configurado para futuras validaciones." : `Pendiente: se necesitan al menos ${MIN_VALIDATION_QUORUM} líderes activos y el gerente general o máximo director.`}</p><p className="mt-3 text-[13px] text-[#5A626F]">Los votos y aprobaciones se implementarán con cada etapa metodológica.</p></section>
        {canManageTeam(actor.role) && <section className="rounded-2xl border border-[#E6DFD6] bg-white p-6"><h2 className="text-xl font-semibold text-[#192538]">Agregar integrante</h2><p className="mt-2 text-[14px] leading-6 text-[#5A626F]">Registrar a una persona aquí no le envía una invitación ni le abre el Site.</p><div className="mt-6"><MemberForm actorRole={actor.role} /></div></section>}
      </div>
    </div>
  </div></AppShell>;
}
