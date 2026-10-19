import { DIRECTIONS, type Direction } from "./mdep.ts";

export type AffinitySuggestion = { direction: Direction; score: number; rationale: string; evidence_ids: string[] };

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
