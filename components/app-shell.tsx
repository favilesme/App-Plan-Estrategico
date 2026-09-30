"use client";

import Link from "next/link";
import { CircleDot, Gauge, LockKeyhole, UsersRound } from "lucide-react";
import { modules, moduleHref, type ModuleSlug } from "@/lib/modules";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

export function AppShell({ children, active = "home" }: { children: React.ReactNode; active?: ModuleSlug | "home" | "equipo" }) {
  return (
    <SidebarProvider>
      <Sidebar className="border-r border-[#20364c] bg-[#0d2034] text-[#e8f1f3]">
        <SidebarHeader className="px-5 pb-5 pt-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Anima Praxis, inicio">
            <span className="flex size-10 items-center justify-center rounded-xl border border-[#5cc3bb]/50 bg-[#103a4b] text-lg font-semibold text-[#88e3d8]">A</span>
            <span className="min-w-0"><span className="block text-[13px] font-semibold uppercase tracking-[0.2em] text-[#9dd7d1]">Anima Praxis</span><span className="block text-[13px] text-[#b9cad4]">Plan estratégico</span></span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="px-3 pb-5">
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-[12px] uppercase tracking-[0.12em] text-[#7ea4b2]">Espacio de trabajo</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild isActive={active === "home"} className="h-10 text-[#b9cad4] hover:bg-[#173a4e] hover:text-white data-[active=true]:bg-[#1b5262] data-[active=true]:text-white"><Link href="/"><Gauge className="size-4" /><span>Mi plan estratégico</span></Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild isActive={active === "equipo"} className="h-10 text-[#b9cad4] hover:bg-[#173a4e] hover:text-white data-[active=true]:bg-[#1b5262] data-[active=true]:text-white"><Link href="/equipo"><UsersRound className="size-4" /><span>Equipo de Alto Nivel</span></Link></SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-3 text-[12px] uppercase tracking-[0.12em] text-[#7ea4b2]">Metodología</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>
              {modules.map((item) => (
                <SidebarMenuItem key={item.slug}>
                  <SidebarMenuButton asChild isActive={active === item.slug} className="h-9 text-[#b9cad4] hover:bg-[#173a4e] hover:text-white data-[active=true]:bg-[#1b5262] data-[active=true]:text-white">
                    <Link href={moduleHref(item.slug)}><span className="w-6 text-[12px] font-medium text-[#6faeb2]">{item.number}</span><span className="truncate">{item.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-[#274052] px-5 py-5"><div className="flex items-center gap-2 text-[13px] text-[#9db4c0]"><LockKeyhole className="size-4" /> Piloto privado · Sprint 1</div></SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-[#f4f7f7]">
        <header className="flex h-17 items-center justify-between border-b border-[#dce5e8] bg-white px-5 lg:px-9">
          <div className="flex items-center gap-3"><SidebarTrigger className="text-[#173349]" aria-label="Abrir menú" /><span className="text-sm font-semibold text-[#244557]">Mi plan estratégico</span></div>
          <div className="flex items-center gap-2 rounded-full border border-[#d5e8e6] bg-[#eff8f6] px-3 py-1.5 text-[13px] font-medium text-[#256c68]"><CircleDot className="size-3" /> Entorno de prueba</div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
