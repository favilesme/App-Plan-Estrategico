import { getD1 } from "@/db";
import type { MdepAssessment } from "@/lib/sprint5";
import type { Perspective } from "./sprint6-policy.mts";

export { PERSPECTIVES, bscCoverage, initiativeActionBelongsToObjective, parseIds, sourceEvidenceIds } from "./sprint6-policy.mts";
export type { Perspective } from "./sprint6-policy.mts";
export const PERSPECTIVE_LABELS: Record<Perspective, string> = {
  financiera: "Financiera",
  cliente: "Cliente",
  procesos: "Procesos internos",
  aprendizaje: "Aprendizaje y crecimiento",
};

export type StrategicObjective = {
  id: string; cycle_id: string; assessment_id: string; perspective: Perspective;
  statement: string; desired_result: string; strategy_link: string;
  source_action_ids_json: string; evidence_ids_json: string; evidence_note: string;
  kpi_name: string; kpi_unit: string; kpi_definition: string;
  status: "draft" | "approved"; version: number; updated_by_user_id: string;
  created_at: string; updated_at: string;
};
export type StrategicInitiative = {
  id: string; cycle_id: string; objective_id: string; objective_version: number; source_action_id: string;
  statement: string; expected_result: string; responsible_member_id: string;
  evidence_note: string; status: "draft" | "approved"; version: number;
  updated_by_user_id: string; created_at: string; updated_at: string;
};
export type ApprovedStrategy = MdepAssessment & { cycle_id: string; source_snapshot_id: string };

export async function getApprovedStrategy(cycleId: string): Promise<ApprovedStrategy | null> {
  return getD1().prepare(`SELECT m.*, s.cycle_id, f.source_snapshot_id
    FROM mdep_assessments m
    JOIN strategic_action_sets s ON s.id = m.action_set_id
    JOIN foda_matrix_versions f ON f.id = s.matrix_id
    WHERE s.cycle_id = ? AND s.status = 'approved' AND m.status = 'approved'
    ORDER BY m.approved_at DESC LIMIT 1`).bind(cycleId).first<ApprovedStrategy>();
}

export async function getObjectives(assessmentId: string): Promise<StrategicObjective[]> {
  return (await getD1().prepare("SELECT * FROM strategic_objectives WHERE assessment_id = ? ORDER BY created_at, rowid")
    .bind(assessmentId).all<StrategicObjective>()).results ?? [];
}

export async function getInitiatives(cycleId: string): Promise<StrategicInitiative[]> {
  return (await getD1().prepare("SELECT * FROM strategic_initiatives WHERE cycle_id = ? ORDER BY created_at, rowid")
    .bind(cycleId).all<StrategicInitiative>()).results ?? [];
}

