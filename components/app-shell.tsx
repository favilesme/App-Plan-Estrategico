"use client";

import Image from "next/image";
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
      <Sidebar className="border-r border-[#48515e] bg-[#192538] text-white">
        <SidebarHeader className="px-4 pb-5 pt-5">
          <Link href="/" className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6C99F]" aria-label="Anima Praxis, inicio">
            <Image src="/brand/anima-praxis-rectangular.png" alt="Anima Praxis. Conciencia que transforma. Acción que enraíza." width={1983} height={793} priority unoptimized className="h-auto w-full" />
          </Link>
          <p className="px-1 pt-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-[#E6C99F]">Plan estratégico</p>
        </SidebarHeader>
        <SidebarContent className="px-3 pb-5">
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-[12px] uppercase tracking-[0.12em] text-[#E6C99F]">Espacio de trabajo</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild isActive={active === "home"} className="h-10 text-[#f5f0e8] hover:bg-[#344052] hover:text-white data-[active=true]:bg-[#D6A871] data-[active=true]:text-[#192538]"><Link href="/"><Gauge className="size-4" /><span>Mi plan estratégico</span></Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild isActive={active === "equipo"} className="h-10 text-[#f5f0e8] hover:bg-[#344052] hover:text-white data-[active=true]:bg-[#D6A871] data-[active=true]:text-[#192538]"><Link href="/equipo"><UsersRound className="size-4" /><span>Equipo de Alto Nivel</span></Link></SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-3 text-[12px] uppercase tracking-[0.12em] text-[#E6C99F]">Metodología</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>
              {modules.map((item) => (
                <SidebarMenuItem key={item.slug}>
                  <SidebarMenuButton asChild isActive={active === item.slug} className="h-9 text-[#f5f0e8] hover:bg-[#344052] hover:text-white data-[active=true]:bg-[#D6A871] data-[active=true]:text-[#192538] data-[active=true]:[&>span:first-child]:text-[#192538]">
                    <Link href={moduleHref(item.slug)}><span className="w-6 text-[12px] font-medium text-[#E6C99F]">{item.number}</span><span className="truncate">{item.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-[#48515e] px-5 py-5"><div className="flex items-center gap-2 text-[13px] text-[#E6C99F]"><LockKeyhole className="size-4" /> Piloto privado · Sprint 2</div></SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-[#faf8f4]">
        <header className="flex h-17 items-center justify-between border-b border-[#e6dfd6] bg-white px-5 lg:px-9">
          <div className="flex items-center gap-3"><SidebarTrigger className="text-[#192538]" aria-label="Abrir menú" /><span className="text-sm font-semibold text-[#192538]">Mi plan estratégico</span></div>
          <div className="flex items-center gap-2 rounded-full border border-[#E6C99F] bg-[#fbf5eb] px-3 py-1.5 text-[13px] font-medium text-[#192538]"><CircleDot className="size-3" /> Entorno de prueba</div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
