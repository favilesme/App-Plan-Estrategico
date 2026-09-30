import { LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export function AccessNotice({ configured }: { configured: boolean }) {
  return <AppShell><div className="mx-auto w-full max-w-3xl px-5 py-16 lg:px-9">
    <div className="rounded-2xl border border-[#dbe5e7] bg-white p-8">
      <LockKeyhole className="size-8 text-[#0e766f]" />
      <h1 className="mt-5 text-2xl font-semibold text-[#102b3f]">{configured ? "Acceso pendiente" : "Configuración del propietario pendiente"}</h1>
      <p className="mt-3 text-[16px] leading-7 text-[#58717d]">{configured
        ? "Tu cuenta puede abrir este Site, pero aún no tiene un rol asignado en la aplicación. Solicita al propietario que te incorpore al equipo."
        : "El propietario debe configurar su identidad en los ajustes privados de este Site antes de crear la organización."}</p>
    </div>
  </div></AppShell>;
}
