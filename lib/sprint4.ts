import { getD1 } from "@/db";
import type { CrossScore, FrozenFoda, MatrixVersion, MatrixVote, Vulnerability } from "@/lib/foda-matrix";
import type { FodaSnapshot } from "@/lib/sprint3";

export function matrixReviewSubject(matrix: MatrixVersion) {
  return `${matrix.id}:r${matrix.revision}`;
}

export async function getMatrixVersions(setId: string) {
  const result = await getD1().prepare("SELECT * FROM foda_matrix_versions WHERE set_id = ? ORDER BY set_version DESC, matrix_version DESC")
    .bind(setId).all<MatrixVersion>();
  return result.results ?? [];
}

export async function getMatrixVersion(matrixId: string, setId: string) {
  return getD1().prepare("SELECT * FROM foda_matrix_versions WHERE id = ? AND set_id = ?")
    .bind(matrixId, setId).first<MatrixVersion>();
}

export async function getMatrixScores(matrixId: string) {
  const result = await getD1().prepare("SELECT * FROM foda_cross_scores WHERE matrix_id = ? ORDER BY quadrant, rowid")
    .bind(matrixId).all<CrossScore>();
  return result.results ?? [];
}

export type QualitativeNote = {
  id: string; matrix_id: string; quadrant: "FA" | "DO"; narrative: string;
  factor_ids_json: string; updated_by_user_id: string; version: number; updated_at: string;
};

export async function getQualitativeNotes(matrixId: string) {
  const result = await getD1().prepare("SELECT * FROM foda_qualitative_notes WHERE matrix_id = ? ORDER BY quadrant")
    .bind(matrixId).all<QualitativeNote>();
  return result.results ?? [];
}

export async function getVulnerabilities(matrixId: string) {
  const result = await getD1().prepare("SELECT * FROM foda_vulnerabilities WHERE matrix_id = ? ORDER BY rowid")
    .bind(matrixId).all<Vulnerability>();
  return result.results ?? [];
}

export async function getMatrixVotes(matrix: MatrixVersion) {
  const result = await getD1().prepare("SELECT * FROM foda_matrix_votes WHERE matrix_id = ? AND matrix_revision = ? ORDER BY rowid DESC")
    .bind(matrix.id, matrix.revision).all<MatrixVote>();
  return result.results ?? [];
}

export async function getMatrixReview(cycleId: string, matrix: MatrixVersion) {
  return getD1().prepare("SELECT id, status, rationale, reviewer_user_id, source_ids_json, created_at FROM approvals WHERE cycle_id = ? AND gate_key = 'foda.matrix' AND subject_id = ? ORDER BY rowid DESC LIMIT 1")
    .bind(cycleId, matrixReviewSubject(matrix))
    .first<{ id: string; status: string; rationale: string; reviewer_user_id: string; source_ids_json: string; created_at: string }>();
}

export async function getMatrixSource(snapshotId: string): Promise<{ record: FodaSnapshot; data: FrozenFoda } | null> {
  const record = await getD1().prepare("SELECT * FROM foda_set_snapshots WHERE id = ?")
    .bind(snapshotId).first<FodaSnapshot>();
  if (!record) return null;
  const data = JSON.parse(record.snapshot_json) as FrozenFoda;
  if (!Array.isArray(data.factors) || data.version !== record.version || data.setId !== record.set_id) return null;
  return { record, data };
}
