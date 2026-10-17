/** An explicit priority written in narrative text must agree with the numeric Pᵢ field. */
export function statedActionPriority(text: string): number | null {
  const match = text.match(/prioridad\s*(?:propuesta|de\s+la\s+acci[oó]n)?\s*[:=]\s*([1-5])\s*\/\s*5\b/i);
  return match ? Number(match[1]) : null;
}

export function actionPriorityConflict(action: { priority: number | null; expected_effect: string; priority_rationale: string | null }): boolean {
  const statements = [action.expected_effect, action.priority_rationale ?? ""];
  return statements.some((statement) => {
    const stated = statedActionPriority(statement);
    return stated !== null && stated !== action.priority;
  });
}
