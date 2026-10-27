import { bscCoverage, initiativeActionBelongsToObjective, parseIds } from "./sprint6-policy.mts";
import { MIN_VALIDATION_QUORUM } from "./methodology.ts";

export type ReviewStage = "objectives" | "initiatives";
export type ReviewVote = { id: string; reviewer_user_id: string; status: string; rationale: string; created_at: string };
export type ReviewMember = { id: string; auth_user_id: string | null; display_name: string; role: string;
  status: string; is_leader: number; is_director: number };
export type ReviewObjective = { id: string; version: number; perspective: "financiera" | "cliente" | "procesos" | "aprendizaje";
  status: string; source_action_ids_json: string; evidence_ids_json: string };
export type ReviewInitiative = { id: string; version: number; status: string; objective_id: string;
  objective_version: number; source_action_id: string; responsible_member_id: string };

export function reviewTokens(stage: ReviewStage, objectives: ReviewObjective[], initiatives: ReviewInitiative[]): string[] {
  return (stage === "objectives"
    ? objectives.map((item) => `o:${item.id}:v${item.version}`)
    : initiatives.map((item) => `i:${item.id}:v${item.version}:o:${item.objective_id}:v${item.objective_version}`))
    .sort();
}

export function reviewSubject(cycleId: string, assessmentId: string, stage: ReviewStage, tokens: string[]): string {
  return `${cycleId}:${assessmentId}:${stage}:${tokens.join("|")}`;
}

export function reviewBlockers(stage: ReviewStage, objectives: ReviewObjective[], initiatives: ReviewInitiative[],
  members: ReviewMember[], approvedActionIds: string[]): string[] {
  const blockers: string[] = [];
  const coverage = bscCoverage(objectives);
  if (coverage.count !== 4) blockers.push(`Faltan objetivos en ${coverage.missing.length} perspectiva(s) BSC.`);
  if (objectives.some((item) => !["draft", "approved"].includes(item.status) ||
    !parseIds(item.source_action_ids_json).length || !parseIds(item.evidence_ids_json).length ||
    parseIds(item.source_action_ids_json).some((id) => !approvedActionIds.includes(id))))
    blockers.push("Hay objetivos sin acciones aprobadas o referencias de evidencia vigentes.");
  if (stage === "objectives") {
    if (objectives.some((item) => item.status !== "draft")) blockers.push("El conjunto de objetivos ya tiene una decisión final.");
    return blockers;
  }
  if (objectives.some((item) => item.status !== "approved"))
    blockers.push("La dirección debe aprobar los objetivos antes de revisar las iniciativas.");
  if (!initiatives.length) blockers.push("Registra al menos una iniciativa trazable.");
  if (initiatives.some((item) => {
    const objective = objectives.find((candidate) => candidate.id === item.objective_id);
    return item.status !== "draft" || !objective || item.objective_version !== objective.version ||
      !initiativeActionBelongsToObjective(objective.source_action_ids_json, item.source_action_id) ||
      !members.some((member) => member.id === item.responsible_member_id && member.status === "active");
  })) blockers.push("Hay iniciativas con objetivo, versión, acción o responsable que deben corregirse.");
  return blockers;
}

export function reviewVoteState(votes: ReviewVote[], members: ReviewMember[]) {
  const eligible = new Map(members.filter((member) => member.status === "active" && member.is_leader &&
    ["owner", "admin", "leader"].includes(member.role) && member.auth_user_id)
    .map((member) => [member.auth_user_id!, member]));
  const byUser = new Map<string, ReviewVote>();
  for (const vote of votes) if (eligible.has(vote.reviewer_user_id) && !byUser.has(vote.reviewer_user_id))
    byUser.set(vote.reviewer_user_id, vote);
  const current = [...byUser.values()];
  const participants = current.filter((vote) => vote.status !== "changes_requested");
  const hasDirector = participants.some((vote) => eligible.get(vote.reviewer_user_id)?.is_director);
  const hasChangesRequested = current.some((vote) => vote.status === "changes_requested");
  return { current, count: participants.length, hasDirector, hasChangesRequested,
    hasDoubt: participants.some((vote) => vote.status === "doubt"),
    ready: participants.length >= MIN_VALIDATION_QUORUM && hasDirector && !hasChangesRequested };
}

export function reviewSourceIds(tokens: string[], voteIds: string[]): string[] {
  return [...tokens, ...voteIds].sort();
}

export function sameReviewSource(raw: string, tokens: string[], voteIds: string[]): boolean {
  try {
    const saved: unknown = JSON.parse(raw);
    return Array.isArray(saved) && saved.every((value) => typeof value === "string") &&
      JSON.stringify([...saved].sort()) === JSON.stringify(reviewSourceIds(tokens, voteIds));
  } catch { return false; }
}
