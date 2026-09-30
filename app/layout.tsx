import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anima Praxis · Mi plan estratégico",
  description: "Espacio privado de planificación estratégica asistida de Anima Praxis.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className="antialiased">{children}</body></html>;
}
