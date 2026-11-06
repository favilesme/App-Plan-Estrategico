import { getD1 } from "@/db";
import { reviewVoteState, sameReviewSource, type ReviewVote } from "@/lib/sprint6-review-policy.mts";
import { sprint7ReviewBlockers, sprint7ReviewSubject, sprint7ReviewTokens,
  type ReviewPackage } from "@/lib/sprint7-review-policy.mts";
import type { Member } from "@/lib/workspace";

export const sprint7Gate = (step: "vote" | "review" | "final") => `sprint7.demo.${step}`;

export type Sprint7Decision = { id: string; status: string; rationale: string; reviewer_user_id: string;
  source_ids_json: string; created_at: string };

export async function getSprint7ReviewState(input: ReviewPackage & { members: Member[] }) {
  const tokens = sprint7ReviewTokens(input);
  const subject = await sprint7ReviewSubject(input.cycle.id, tokens);
  const blockers = sprint7ReviewBlockers(input);
  const db = getD1();
  const [voteRows, review, final] = await Promise.all([
    db.prepare("SELECT id, reviewer_user_id, status, rationale, created_at FROM approvals WHERE cycle_id = ? AND gate_key = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 100")
      .bind(input.cycle.id, sprint7Gate("vote"), subject).all<ReviewVote>(),
    db.prepare("SELECT id, status, rationale, reviewer_user_id, source_ids_json, created_at FROM approvals WHERE cycle_id = ? AND gate_key = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 1")
      .bind(input.cycle.id, sprint7Gate("review"), subject).first<Sprint7Decision>(),
    db.prepare("SELECT id, status, rationale, reviewer_user_id, source_ids_json, created_at FROM approvals WHERE cycle_id = ? AND gate_key = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 1")
      .bind(input.cycle.id, sprint7Gate("final"), subject).first<Sprint7Decision>(),
  ]);
  const votes = reviewVoteState(voteRows.results ?? [], input.members);
  const voteIds = votes.current.map((vote) => vote.id);
  const reviewCurrent = review && sameReviewSource(review.source_ids_json, tokens, voteIds) ? review : null;
  const finalCurrent = final && reviewCurrent?.status === "approved" &&
    sameReviewSource(final.source_ids_json, tokens, [reviewCurrent.id]) ? final : null;
  const allDraft = [...input.plans, ...input.kpis, ...input.budgets, ...input.areas]
    .every((item) => item.status === "draft");
  const allApproved = [...input.plans, ...input.kpis, ...input.budgets, ...input.areas]
    .every((item) => item.status === "approved");
  const approved = Boolean(finalCurrent?.status === "approved" && allApproved && blockers.length === 0);
  return { tokens, subject, blockers, votes, review: reviewCurrent, reviewRecorded: Boolean(review),
    final: finalCurrent, approved, allDraft,
    readyForVote: allDraft && !blockers.length && !review && !final,
    readyForReview: allDraft && !blockers.length && votes.ready && !review && !final,
    readyForFinal: allDraft && !blockers.length && votes.ready && reviewCurrent?.status === "approved" && !final };
}
