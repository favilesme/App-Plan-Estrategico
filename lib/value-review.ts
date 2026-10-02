import type { PhilosophyStatement, ValueBehavior } from "./sprint2";

export type ValueReviewRecord = {
  id: string;
  gate_key: string;
  subject_id: string;
  status: string;
  rationale: string;
  reviewer_user_id: string;
  source_ids_json: string;
  created_at: string;
};

export type ResolvedValueReview = {
  record: ValueReviewRecord;
  origin: "individual" | "legacy_group";
};

const valueVersion = (item: ValueBehavior) => `${item.id}:v${item.version}`;
const statementVersions = (statements: PhilosophyStatement[]) =>
  statements.map((item) => `${item.id}:v${item.version}`).sort();

// A set keeps its own review when a different set is edited. A change to the
// approved mission or vision still requires checking the philosophical link.
export function valueReviewSubject(item: ValueBehavior, statements: PhilosophyStatement[]) {
  return [valueVersion(item), ...statementVersions(statements)].join("|");
}

export function resolveValueReview(
  item: ValueBehavior,
  statements: PhilosophyStatement[],
  reviews: ValueReviewRecord[],
): ResolvedValueReview | null {
  const subject = valueReviewSubject(item, statements);
  const individual = reviews.find((review) =>
    review.gate_key === "philosophy.value" && review.subject_id === subject
  );
  if (individual) return { record: individual, origin: "individual" };

  // Sprint 2 initially approved the whole collection. Keep unchanged sets
  // approved while their own version and the statement versions still match.
  const tokens = [valueVersion(item), ...statementVersions(statements)];
  const legacy = reviews.find((review) => {
    if (review.gate_key !== "philosophy.values") return false;
    const approvedTokens = new Set(review.subject_id.split("|"));
    return tokens.every((token) => approvedTokens.has(token));
  });
  return legacy?.status === "approved" ? { record: legacy, origin: "legacy_group" } : null;
}

export function lastIndividualValueReview(item: ValueBehavior, reviews: ValueReviewRecord[]) {
  return reviews.find((review) =>
    review.gate_key === "philosophy.value" && review.subject_id.startsWith(`${item.id}:v`)
  ) ?? null;
}

export function lastLegacyValueReview(reviews: ValueReviewRecord[]) {
  return reviews.find((review) => review.gate_key === "philosophy.values") ?? null;
}
