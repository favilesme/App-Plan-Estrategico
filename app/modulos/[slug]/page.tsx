import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { AccessNotice } from "@/components/access-notice";
import { AppShell } from "@/components/app-shell";
import { canRead, getActor } from "@/lib/authz";
import { modules, type ModuleSlug } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const selectedModule = modules.find((item) => item.slug === slug && item.slug !== "organizacion" && item.slug !== "diagnostico");
  if (!selectedModule) notFound();
  const actor = await getActor();
  if (!actor) redirect(chatGPTSignInPath(`/modulos/${slug}`));
  if (actor.role === "unconfigured" || !canRead(actor.role)) return <AccessNotice configured={actor.role !== "unconfigured"} />;

  return <AppShell active={selectedModule.slug as ModuleSlug}><div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-9 lg:py-10"><Link href="/" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#192538] hover:text-[#192538]"><ArrowLeft className="size-4" /> Volver al plan</Link><div className="mt-8 rounded-2xl border border-[#E6DFD6] bg-white p-8"><p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#192538]">Módulo {selectedModule.number} · {selectedModule.phase}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#192538]">{selectedModule.title}</h1><div className="mt-8 flex items-start gap-4 rounded-xl border border-[#E6DFD6] bg-[#FAF8F4] p-5"><LockKeyhole className="mt-0.5 size-5 shrink-0 text-[#192538]" /><div><h2 className="text-[16px] font-semibold text-[#192538]">Etapa pendiente</h2><p className="mt-2 text-[15px] leading-6 text-[#5A626F]">Este módulo aún no recibe ni calcula información en el piloto actual. Su estado permanecerá pendiente hasta que se implemente y valide su flujo metodológico.</p></div></div></div></div></AppShell>;
}
