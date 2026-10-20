export const PERSPECTIVES = ["financiera", "cliente", "procesos", "aprendizaje"] as const;
export type Perspective = typeof PERSPECTIVES[number];

export function parseIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? [...new Set(value)] : [];
  } catch { return []; }
}

export function bscCoverage(objectives: { perspective: Perspective }[]) {
  const covered = new Set(objectives.map((item) => item.perspective));
  return { count: PERSPECTIVES.filter((item) => covered.has(item)).length,
    missing: PERSPECTIVES.filter((item) => !covered.has(item)) };
}

export function sourceEvidenceIds(actions: { id: string; evidence_ids_json: string }[], selectedIds: string[]): string[] {
  return [...new Set(actions.filter((action) => selectedIds.includes(action.id))
    .flatMap((action) => parseIds(action.evidence_ids_json)))];
}

export function initiativeActionBelongsToObjective(objectiveActionIdsJson: string, actionId: string): boolean {
  return parseIds(objectiveActionIdsJson).includes(actionId);
}
