import { getD1 } from "@/db";

export type ExecutionPlan = {
  id: string; cycle_id: string; initiative_id: string; initiative_version: number;
  objective_id: string; objective_version: number; responsible_member_id: string | null;
  start_date: string | null; end_date: string | null; milestones_json: string;
  resources: string; risks: string; status: string; version: number;
  updated_by_user_id: string; updated_at: string;
};

export type KpiSpec = {
  id: string; cycle_id: string; objective_id: string; objective_version: number;
  formula: string; denominator: string; requires_denominator: number;
  source: string; baseline: string; target: string; frequency: string;
  responsible_member_id: string | null; direction: string; tolerance: string;
  tolerance_rationale: string; status: string; version: number;
  updated_by_user_id: string; updated_at: string;
};

export type BudgetEntry = {
  id: string; cycle_id: string; plan_id: string; period_key: string; amount: string;
  currency: string; source_note: string; status: string; version: number; updated_at: string;
};

export type AreaScorecard = {
  id: string; cycle_id: string; name: string; objective_ids_json: string;
  status: string; version: number; updated_at: string;
};

export async function getExecutionPlans(cycleId: string): Promise<ExecutionPlan[]> {
  return (await getD1().prepare("SELECT * FROM execution_plans WHERE cycle_id = ? ORDER BY created_at, rowid")
    .bind(cycleId).all<ExecutionPlan>()).results ?? [];
}

export async function getKpiSpecs(cycleId: string): Promise<KpiSpec[]> {
  return (await getD1().prepare("SELECT * FROM kpi_specs WHERE cycle_id = ? ORDER BY created_at, rowid")
    .bind(cycleId).all<KpiSpec>()).results ?? [];
}

export async function getBudgetEntries(cycleId: string): Promise<BudgetEntry[]> {
  return (await getD1().prepare("SELECT * FROM budget_entries WHERE cycle_id = ? ORDER BY period_key, rowid")
    .bind(cycleId).all<BudgetEntry>()).results ?? [];
}

export async function getAreaScorecards(cycleId: string): Promise<AreaScorecard[]> {
  return (await getD1().prepare("SELECT * FROM area_scorecards WHERE cycle_id = ? ORDER BY created_at, rowid")
    .bind(cycleId).all<AreaScorecard>()).results ?? [];
}
