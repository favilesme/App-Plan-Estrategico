import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { MemberForm } from "@/components/member-form";
import { canManageTeam, canRead, getActor } from "@/lib/authz";
import { getMembers } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath("/equipo"));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;
  if (!canManageTeam(actor.role) || !actor.organizationId) redirect("/equipo?error=permission");
  const { id } = await params;
  const member = (await getMembers(actor.organizationId)).find((m) => m.id === id);
  if (!member) notFound();
  if (member.role === "owner" || (actor.role === "admin" && (member.role === "admin" || member.role === "consultant" || member.is_director))) redirect("/equipo?error=permission");
  return <AppShell active="equipo"><div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-9 lg:py-10"><Link href="/equipo" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#192538]"><ArrowLeft className="size-4" /> Volver al equipo</Link><h1 className="mt-6 text-3xl font-semibold text-[#192538]">Editar integrante</h1><p className="mt-2 text-[15px] text-[#5A626F]">Los cambios de rol se guardan en el historial de la organización.</p><div className="mt-7 rounded-2xl border border-[#E6DFD6] bg-white p-6"><MemberForm actorRole={actor.role} member={member} /></div></div></AppShell>;
}
