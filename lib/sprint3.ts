import { getD1 } from "@/db";
import type { FodaEvidence, FodaFactor, FodaSet, FodaValidation } from "@/lib/foda";

export type FodaSnapshot = {
  id: string; set_id: string; version: number; snapshot_json: string;
  validation_ids_json: string; consultant_approval_id: string | null;
  methodology_version: string; frozen_by_user_id: string; frozen_at: string;
};

export type ConsultantReview = {
  id: string; status: string; rationale: string; reviewer_user_id: string;
  source_ids_json: string; created_at: string;
};

export function fodaReviewSubject(set: FodaSet) {
  return `${set.id}:v${set.version}:r${set.revision}`;
}

export async function getFodaSet(cycleId: string) {
  return getD1().prepare("SELECT id, cycle_id, version, revision, status, frozen_at, frozen_by_user_id FROM foda_sets WHERE cycle_id = ?")
    .bind(cycleId).first<FodaSet>();
}

export async function getOrCreateFodaSet(cycleId: string) {
  await getD1().prepare("INSERT OR IGNORE INTO foda_sets (id, cycle_id) VALUES (?, ?)")
    .bind(crypto.randomUUID(), cycleId).run();
  const set = await getFodaSet(cycleId);
  if (!set) throw new Error("No se pudo abrir el FODA base.");
  return set;
}

export async function getFodaFactors(setId: string) {
  const result = await getD1().prepare("SELECT * FROM foda_factors WHERE set_id = ? ORDER BY CASE axis WHEN 'F' THEN 1 WHEN 'D' THEN 2 WHEN 'O' THEN 3 ELSE 4 END, sequence")
    .bind(setId).all<FodaFactor>();
  return result.results ?? [];
}

export async function getFodaEvidence(setId: string) {
  const result = await getD1().prepare("SELECT e.* FROM foda_evidence e JOIN foda_factors f ON f.id = e.factor_id WHERE f.set_id = ? ORDER BY e.created_at, e.id")
    .bind(setId).all<FodaEvidence>();
  return result.results ?? [];
}

export async function getFodaValidations(set: FodaSet) {
  const result = await getD1().prepare("SELECT * FROM foda_validations WHERE set_id = ? AND set_version = ? AND revision = ? ORDER BY rowid DESC")
    .bind(set.id, set.version, set.revision).all<FodaValidation>();
  return result.results ?? [];
}

export async function getConsultantFodaReview(set: FodaSet) {
  return getD1().prepare("SELECT id, status, rationale, reviewer_user_id, source_ids_json, created_at FROM approvals WHERE cycle_id = ? AND gate_key = 'foda.doubt' AND subject_id = ? ORDER BY rowid DESC LIMIT 1")
    .bind(set.cycle_id, fodaReviewSubject(set)).first<ConsultantReview>();
}

export async function getFodaSnapshots(setId: string) {
  const result = await getD1().prepare("SELECT * FROM foda_set_snapshots WHERE set_id = ? ORDER BY version DESC")
    .bind(setId).all<FodaSnapshot>();
  return result.results ?? [];
}
