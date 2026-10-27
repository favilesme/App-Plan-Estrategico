import { getD1 } from "@/db";
import type { Member } from "@/lib/workspace";
import type { StrategicInitiative, StrategicObjective } from "@/lib/sprint6";
import { reviewBlockers, reviewSubject, reviewTokens, reviewVoteState, sameReviewSource,
  type ReviewStage, type ReviewVote } from "./sprint6-review-policy.mts";

// The existing approvals ledger stores team votes, consultant reviews, and
// director decisions under distinct gate keys tied to immutable version tokens.

export type StageReview = { id: string; status: "approved" | "changes_requested"; rationale: string;
  reviewer_user_id: string; source_ids_json: string; created_at: string };

export const stageGate = (stage: ReviewStage, step: "vote" | "review" | "final") => `sprint6.${stage}.${step}`;

export async function getStageState(input: { cycleId: string; assessmentId: string; stage: ReviewStage;
  objectives: StrategicObjective[]; initiatives: StrategicInitiative[]; members: Member[]; approvedActionIds: string[] }) {
  const { cycleId, assessmentId, stage, objectives, initiatives, members, approvedActionIds } = input;
  const tokens = reviewTokens(stage, objectives, initiatives);
  const subject = reviewSubject(cycleId, assessmentId, stage, tokens);
  const db = getD1();
  const [voteRows, review] = await Promise.all([
    db.prepare("SELECT id, reviewer_user_id, status, rationale, created_at FROM approvals WHERE cycle_id = ? AND gate_key = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 100")
      .bind(cycleId, stageGate(stage, "vote"), subject).all<ReviewVote>(),
    db.prepare("SELECT id, status, rationale, reviewer_user_id, source_ids_json, created_at FROM approvals WHERE cycle_id = ? AND gate_key = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 1")
      .bind(cycleId, stageGate(stage, "review"), subject).first<StageReview>(),
  ]);
  const votes = reviewVoteState(voteRows.results ?? [], members);
  const blockers = reviewBlockers(stage, objectives, initiatives, members, approvedActionIds);
  const reviewCurrent = review && sameReviewSource(review.source_ids_json, tokens, votes.current.map((vote) => vote.id))
    ? review : null;
  const approved = stage === "objectives"
    ? objectives.length > 0 && objectives.every((item) => item.status === "approved")
    : initiatives.length > 0 && initiatives.every((item) => item.status === "approved");
  return { stage, tokens, subject, votes, blockers, review: reviewCurrent, reviewRecorded: Boolean(review), approved,
    readyForReview: !blockers.length && votes.ready && !review,
    readyForFinal: !blockers.length && votes.ready && reviewCurrent?.status === "approved" };
}
