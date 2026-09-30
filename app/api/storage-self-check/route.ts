import { env } from "cloudflare:workers";
import { getActor } from "@/lib/authz";

export const dynamic = "force-dynamic";

// Local pilot diagnostic. Production returns 404 before touching storage.
export async function GET() {
  if (!import.meta.env.DEV) return new Response(null, { status: 404 });
  const actor = await getActor();
  if (actor?.role !== "owner") return new Response(null, { status: 403 });
  const bucket = env.BUCKET;
  if (!bucket) return Response.json({ r2: "binding_missing" }, { status: 503 });

  const key = `sprint-1-check/${crypto.randomUUID()}.txt`;
  const expected = "anima-praxis-r2-local-check";
  try {
    await bucket.put(key, expected);
    const object = await bucket.get(key);
    const actual = await object?.text();
    return Response.json({ r2: actual === expected ? "ok" : "mismatch" }, { status: actual === expected ? 200 : 500 });
  } finally {
    await bucket.delete(key);
  }
}
