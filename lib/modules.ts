export const modules = [
  { number: "01", title: "Información de la empresa", slug: "organizacion", phase: "Base" },
  { number: "02", title: "Diagnóstico estratégico", slug: "diagnostico", phase: "Diagnóstico" },
  { number: "03", title: "Análisis interno", slug: "analisis-interno", phase: "Diagnóstico" },
  { number: "04", title: "Análisis externo", slug: "analisis-externo", phase: "Diagnóstico" },
  { number: "05", title: "FODA cuantitativa", slug: "foda", phase: "Dirección" },
  { number: "06", title: "Formulación estratégica", slug: "formulacion", phase: "Dirección" },
  { number: "07", title: "Estrategia competitiva", slug: "porter", phase: "Dirección" },
  { number: "08", title: "Objetivos estratégicos", slug: "objetivos", phase: "Ejecución" },
  { number: "09", title: "Iniciativas", slug: "iniciativas", phase: "Ejecución" },
  { number: "10", title: "Plan de ejecución", slug: "ejecucion", phase: "Ejecución" },
  { number: "11", title: "KPIs", slug: "kpis", phase: "Ejecución" },
  { number: "12", title: "Seguimiento", slug: "seguimiento", phase: "Seguimiento" },
  { number: "13", title: "Revisión estratégica", slug: "revision", phase: "Seguimiento" },
  { number: "14", title: "Informe ejecutivo", slug: "informe", phase: "Informe" },
] as const;

export type ModuleSlug = (typeof modules)[number]["slug"];

export function moduleHref(slug: ModuleSlug) {
  if (slug === "organizacion") return "/organizacion";
  if (slug === "diagnostico") return "/diagnostico";
  return `/modulos/${slug}`;
}
