import { FodaMatrixPage } from "@/components/foda-matrix-page";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<{ matrix?: string; quadrant?: string; pair?: string; error?: string; saved?: string; suggested?: string; voted?: string; reviewed?: string; approved?: string; reopened?: string }> }) {
  return <FodaMatrixPage searchParams={searchParams} />;
}
