import { MAX_FODA_FACTORS_PER_AXIS, MIN_VALIDATION_QUORUM } from "./methodology.ts";
import type { EligibleLeader, FodaEvidence, FodaFactor } from "./foda.ts";

export const CROSS_SCORES = [0, 1, 3, 9] as const;
export type CrossScoreValue = (typeof CROSS_SCORES)[number];
export type QuantifiedQuadrant = "FO" | "DA";

export type FrozenFactor = FodaFactor & { evidence: FodaEvidence[] };
export type FrozenFoda = {
  setId: string; version: number; revision: number; factors: FrozenFactor[];
};
export type MatrixVersion = {
  id: string; set_id: string; set_version: number; matrix_version: number;
  source_snapshot_id: string; revision: number; status: "draft" | "approved";
  created_by_user_id: string; approved_by_user_id: string | null;
  approved_at: string | null; created_at: string; updated_at: string;
};
export type CrossScore = {
  id: string; matrix_id: string; quadrant: QuantifiedQuadrant;
  internal_factor_id: string; external_factor_id: string;
  suggested_score: CrossScoreValue | null; suggested_rationale: string | null;
  suggested_evidence_ids_json: string;
  final_score: CrossScoreValue | null; final_rationale: string | null;
  final_evidence_ids_json: string; updated_by_user_id: string | null;
  version: number; updated_at: string;
};
export type MatrixVote = {
  id: string; matrix_id: string; matrix_revision: number; member_id: string;
  decision: "validated" | "doubt" | "changes_requested";
  rationale: string; created_at: string;
};

export const quadrantLabels: Record<QuantifiedQuadrant, string> = {
  FO: "Zona de Éxito", DA: "Zona Vulnerable",
};

export const VULNERABILITY_LEVELS = ["Alta", "Media", "Baja"] as const;
export type VulnerabilityLevel = typeof VULNERABILITY_LEVELS[number];
export type Vulnerability = { id: string; matrix_id: string; weakness_factor_id: string;
  impact: VulnerabilityLevel; probability: VulnerabilityLevel; action_capacity: VulnerabilityLevel;
  rationale: string; evidence_ids_json: string; updated_by_user_id: string; version: number; updated_at: string };

export function vulnerabilityResult(item: Pick<Vulnerability, "impact" | "probability" | "action_capacity">) {
  const severity = { Alta: 100, Media: 75, Baja: 50 };
  const capacity = { Alta: 75, Media: 50, Baja: 25 };
  const impact = severity[item.impact], probability = severity[item.probability], actionCapacity = capacity[item.action_capacity];
  if (!impact || !probability || !actionCapacity) return null;
  const degree = impact * probability / 100;
  const zone = degree > 65 ? (actionCapacity <= 35 ? "Muy crítico" : "Crítico") :
    (actionCapacity <= 35 ? "Alerta" : "Preparado");
  return { impact, probability, actionCapacity, degree, zone,
    order: { "Muy crítico": 0, "Crítico": 1, "Alerta": 2, "Preparado": 3 }[zone] };
}

export function matrixFactors(snapshot: FrozenFoda, axis: FodaFactor["axis"]) {
  return snapshot.factors.filter((factor) => factor.axis === axis && factor.status === "approved")
    .sort((a, b) => a.sequence - b.sequence);
}

export function matrixPairs(snapshot: FrozenFoda, quadrant: QuantifiedQuadrant) {
  const internal = matrixFactors(snapshot, quadrant === "FO" ? "F" : "D");
  const external = matrixFactors(snapshot, quadrant === "FO" ? "O" : "A");
  if (!internal.length || !external.length || internal.length > MAX_FODA_FACTORS_PER_AXIS ||
      external.length > MAX_FODA_FACTORS_PER_AXIS) return [];
  return external.flatMap((outer) => internal.map((inner) => ({
    quadrant, internal: inner, external: outer,
    key: `${quadrant}:${inner.id}:${outer.id}`,
  })));
}

export function scoreKey(score: Pick<CrossScore, "quadrant" | "internal_factor_id" | "external_factor_id">) {
  return `${score.quadrant}:${score.internal_factor_id}:${score.external_factor_id}`;
}

export function scoreEvidenceIds(score: CrossScore) {
  try {
    const parsed: unknown = JSON.parse(score.final_evidence_ids_json);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed as string[] : [];
  } catch { return []; }
}

export function completeScore(score: CrossScore | undefined, pair: ReturnType<typeof matrixPairs>[number]) {
  if (!score || !CROSS_SCORES.includes(score.final_score as CrossScoreValue) ||
      (score.final_rationale?.trim().length ?? 0) < 10) return false;
  const allowed = new Set([...pair.internal.evidence, ...pair.external.evidence].map((item) => item.id));
  const linked = scoreEvidenceIds(score);
  return linked.length > 0 && linked.every((id) => allowed.has(id));
}

export function quadrantResults(snapshot: FrozenFoda, quadrant: QuantifiedQuadrant, scores: CrossScore[]) {
  const pairs = matrixPairs(snapshot, quadrant);
  const byKey = new Map(scores.map((score) => [scoreKey(score), score]));
  const completed = pairs.filter((pair) => completeScore(byKey.get(pair.key), pair));
  const complete = pairs.length > 0 && completed.length === pairs.length;
  const internal = matrixFactors(snapshot, quadrant === "FO" ? "F" : "D");
  const external = matrixFactors(snapshot, quadrant === "FO" ? "O" : "A");
  const ranked = [...internal, ...external].map((factor) => {
    const related = completed.filter((pair) => pair.internal.id === factor.id || pair.external.id === factor.id);
    const total = related.reduce((sum, pair) => sum + (byKey.get(pair.key)?.final_score ?? 0), 0);
    const denominator = factor.axis === "F" || factor.axis === "D" ? external.length : internal.length;
    const average = complete ? total / denominator : null;
    return { factor, total, denominator, average,
      priority: average === null ? null : average >= 4.5 ? "P1" as const : "P2" as const,
      position: null as number | null };
  });
  if (complete) {
    const sorted = [...ranked].sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
    for (const item of ranked) item.position = sorted.findIndex((other) => other.average === item.average) + 1;
  }
  return {
    quadrant, pairs, byKey, completed: completed.length, expected: pairs.length, complete,
    total: completed.reduce((sum, pair) => sum + (byKey.get(pair.key)?.final_score ?? 0), 0),
    internal: ranked.filter((item) => internal.some((factor) => factor.id === item.factor.id)),
    external: ranked.filter((item) => external.some((factor) => factor.id === item.factor.id)),
  };
}

export function matrixVoteState(votes: MatrixVote[], leaders: EligibleLeader[]) {
  const eligible = new Map(leaders.filter((member) => member.status === "active" && member.is_leader &&
    ["owner", "admin", "leader"].includes(member.role)).map((member) => [member.id, member]));
  const byMember = new Map<string, MatrixVote>();
  for (const vote of votes) if (eligible.has(vote.member_id) && !byMember.has(vote.member_id)) byMember.set(vote.member_id, vote);
  const current = [...byMember.values()];
  const participants = current.filter((vote) => vote.decision !== "changes_requested");
  const count = participants.length;
  const hasDirector = participants.some((vote) => eligible.get(vote.member_id)?.is_director);
  const hasChangesRequested = current.some((vote) => vote.decision === "changes_requested");
  return { current, count, hasDirector, hasDoubt: participants.some((vote) => vote.decision === "doubt"),
    hasChangesRequested, ready: count >= MIN_VALIDATION_QUORUM && hasDirector && !hasChangesRequested };
}
