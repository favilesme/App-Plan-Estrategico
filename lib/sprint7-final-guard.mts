type FinalApprovalInput = {
  id: string;
  cycleId: string;
  subject: string;
  reviewerUserId: string;
  rationale: string;
  sourceIdsJson: string;
  methodologyVersion: string;
  tokens: string[];
};

const sources = [
  { table: "strategic_objectives", prefix: "o:", status: "approved", expression: "'o:' || id || ':v' || version" },
  { table: "strategic_initiatives", prefix: "i:", status: "approved", expression: "'i:' || id || ':v' || version || ':o:' || objective_id || ':v' || objective_version" },
  { table: "execution_plans", prefix: "p:", status: "draft", expression: "'p:' || id || ':v' || version || ':i:' || initiative_id || ':v' || initiative_version" },
  { table: "kpi_specs", prefix: "k:", status: "draft", expression: "'k:' || id || ':v' || version || ':o:' || objective_id || ':v' || objective_version" },
  { table: "budget_entries", prefix: "b:", status: "draft", expression: "'b:' || id || ':v' || version || ':p:' || plan_id || ':' || period_key" },
  { table: "area_scorecards", prefix: "a:", status: "draft", expression: "'a:' || id || ':v' || version" },
] as const;

export function finalApprovalInsert(input: FinalApprovalInput) {
  const guards = sources.map(({ table, prefix, status, expression }) => {
    const expected = input.tokens.filter((token) => token.startsWith(prefix));
    return {
      sql: `(SELECT COUNT(*) FROM ${table} WHERE cycle_id = ?) = ? AND
        (SELECT COUNT(*) FROM ${table} WHERE cycle_id = ? AND status = ? AND
          ${expression} IN (SELECT value FROM json_each(?))) = ?`,
      values: [input.cycleId, expected.length, input.cycleId, status, JSON.stringify(expected), expected.length],
    };
  });
  const sql = `INSERT OR IGNORE INTO approvals
    (id, cycle_id, gate_key, subject_id, status, reviewer_user_id, rationale, source_ids_json, methodology_version)
    SELECT ?, ?, 'sprint7.demo.final', ?, 'approved', ?, ?, ?, ?
    WHERE ${guards.map((guard) => `(${guard.sql})`).join(" AND ")}
    AND NOT EXISTS (SELECT 1 FROM approvals WHERE cycle_id = ? AND gate_key = 'sprint7.demo.final' AND subject_id = ?)`;
  const values = [input.id, input.cycleId, input.subject, input.reviewerUserId, input.rationale,
    input.sourceIdsJson, input.methodologyVersion, ...guards.flatMap((guard) => guard.values),
    input.cycleId, input.subject];
  // Cloudflare D1 permits at most 100 bound parameters in one query.
  if (values.length > 100) throw new Error("Sprint 7 final approval exceeds D1 parameter limit");
  return { sql, values };
}
