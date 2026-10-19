import { DIRECTIONS, type Direction } from "./mdep.ts";

export type AffinitySuggestion = { direction: Direction; score: number; rationale: string; evidence_ids: string[] };
export type EvidenceLabel = { factorCode: string; statement: string };

// Evidence IDs remain in structured links, but explanations must use labels a
// person can recognize. This also repairs drafts generated before aliases existed.
export function readableEvidenceRationale(rationale: string, evidenceById: ReadonlyMap<string, EvidenceLabel>,
  aliasToId: ReadonlyMap<string, string> = new Map()): string {
  let readable = rationale;
  const label = (id: string) => {
    const evidence = evidenceById.get(id);
    return evidence ? `${evidence.factorCode} · ${evidence.statement}` : "[evidencia no identificada]";
  };
  for (const [alias, id] of aliasToId) {
    readable = readable.replace(new RegExp(`\\b${alias}\\b`, "g"), label(id));
  }
  for (const id of evidenceById.keys()) readable = readable.replaceAll(id, label(id));
  return readable.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "[evidencia no identificada]");
}

// Earlier records stored the list directly. Accept both shapes so an existing
// AI draft remains available without another API call or a database migration.
export function parseAffinitySuggestions(raw: string): AffinitySuggestion[] {
  try {
    const value: unknown = JSON.parse(raw);
    const suggestions = Array.isArray(value) ? value :
      value && typeof value === "object" && "suggestions" in value ? value.suggestions : null;
    if (!Array.isArray(suggestions)) return [];
    return suggestions.filter((item): item is AffinitySuggestion =>
      item && typeof item === "object" && DIRECTIONS.includes(item.direction) &&
      Number.isInteger(item.score) && item.score >= 0 && item.score <= 3 &&
      typeof item.rationale === "string" && Array.isArray(item.evidence_ids) &&
      item.evidence_ids.every((id: unknown) => typeof id === "string"));
  } catch { return []; }
}
