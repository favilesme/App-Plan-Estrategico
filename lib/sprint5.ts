import { getD1 } from "@/db";
import type { Direction, StrategicQuadrant } from "@/lib/mdep";

export type ActionSet = { id: string; cycle_id: string; matrix_id: string; business_unit: string; offer: string;
  customers: string; market: string; revision: number; status: "draft" | "approved";
  approved_by_user_id: string | null; approved_at: string | null };
export type StrategicAction = { id: string; action_set_id: string; quadrant: StrategicQuadrant; statement: string;
  expected_effect: string; factor_ids_json: string; evidence_ids_json: string; priority: number | null;
  priority_rationale: string | null; version: number; updated_by_user_id: string; updated_at: string };
export type ActionVote = { id: string; action_set_id: string; set_revision: number; member_id: string;
  decision: "validated" | "doubt" | "changes_requested"; rationale: string; created_at: string };
export type MdepAssessment = { id: string; action_set_id: string; revision: number; status: "draft" | "approved";
  competitive_context: string; choice_direction: Direction | null; choice_rationale: string | null;
  focus_segment: string | null; focus_advantage: "costes" | "diferenciacion" | null;
  focus_exclusions: string | null; approved_by_user_id: string | null; approved_at: string | null };
export type Affinity = { id: string; assessment_id: string; action_id: string; direction: Direction; score: number;
  rationale: string; evidence_ids_json: string; updated_by_user_id: string; version: number; updated_at: string };
export type AffinityDraft = { id: string; assessment_id: string; action_id: string; suggestions_json: string;
  model: string; created_at: string };
export type Criterion = { id: string; assessment_id: string; scope: "general" | "segment"; direction: Direction; criterion_key: string;
  score: number; rationale: string; source_detail: string; updated_by_user_id: string; version: number; updated_at: string };
export type Condition = { id: string; assessment_id: string; direction: Direction; status: "met" | "pending" | "unmet";
  rationale: string; source_detail: string; updated_by_user_id: string; version: number; updated_at: string };
export type DirectionBrief = { id: string; assessment_id: string; direction: Direction; advantages: string; risks: string;
  required_capabilities: string; operational_implications: string; market_coherence: string;
  updated_by_user_id: string; version: number; updated_at: string };
export type MdepVote = { id: string; assessment_id: string; assessment_revision: number; member_id: string;
  direction: Direction; rationale: string; created_at: string };

export async function getActionSet(matrixId: string) {
  return getD1().prepare("SELECT * FROM strategic_action_sets WHERE matrix_id = ?").bind(matrixId).first<ActionSet>();
}
export async function getStrategicActions(setId: string) {
  return (await getD1().prepare("SELECT * FROM strategic_actions WHERE action_set_id = ? ORDER BY created_at, rowid")
    .bind(setId).all<StrategicAction>()).results ?? [];
}
export async function getActionVotes(set: ActionSet) {
  return (await getD1().prepare("SELECT * FROM strategic_action_votes WHERE action_set_id = ? AND set_revision = ? ORDER BY rowid DESC")
    .bind(set.id, set.revision).all<ActionVote>()).results ?? [];
}
export async function getMdep(setId: string) {
  return getD1().prepare("SELECT * FROM mdep_assessments WHERE action_set_id = ?").bind(setId).first<MdepAssessment>();
}
export async function getAffinities(id: string) {
  return (await getD1().prepare("SELECT * FROM mdep_affinities WHERE assessment_id = ? ORDER BY rowid")
    .bind(id).all<Affinity>()).results ?? [];
}
export async function getAffinityDrafts(id: string) {
  return (await getD1().prepare("SELECT * FROM mdep_affinity_drafts WHERE assessment_id = ? ORDER BY rowid")
    .bind(id).all<AffinityDraft>()).results ?? [];
}
export async function getCriteria(id: string) {
  return (await getD1().prepare("SELECT * FROM mdep_criteria WHERE assessment_id = ? ORDER BY rowid")
    .bind(id).all<Criterion>()).results ?? [];
}
export async function getConditions(id: string) {
  return (await getD1().prepare("SELECT * FROM mdep_conditions WHERE assessment_id = ? ORDER BY rowid")
    .bind(id).all<Condition>()).results ?? [];
}
export async function getDirectionBriefs(id: string) {
  return (await getD1().prepare("SELECT * FROM mdep_direction_briefs WHERE assessment_id = ? ORDER BY rowid")
    .bind(id).all<DirectionBrief>()).results ?? [];
}
export async function getMdepVotes(id: string, revision: number) {
  return (await getD1().prepare("SELECT * FROM mdep_votes WHERE assessment_id = ? AND assessment_revision = ? ORDER BY rowid DESC")
    .bind(id, revision).all<MdepVote>()).results ?? [];
}
export async function latestGate(cycleId: string, gate: string, subject: string) {
  return getD1().prepare("SELECT * FROM approvals WHERE cycle_id = ? AND gate_key = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 1")
    .bind(cycleId, gate, subject).first<{ id: string; status: string; rationale: string; source_ids_json: string }>();
}
