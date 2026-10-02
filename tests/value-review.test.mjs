import test from "node:test";
import assert from "node:assert/strict";
import {
  lastIndividualValueReview, resolveValueReview, valueReviewSubject,
} from "../lib/value-review.ts";

const statements = [
  { id: "mission", version: 1 },
  { id: "vision", version: 1 },
];
const value = (id, version = 1) => ({ id, version });
const review = (subject_id, status, rationale, gate_key = "philosophy.value") => ({
  id: `${gate_key}:${subject_id}:${status}`,
  gate_key, subject_id, status, rationale,
  reviewer_user_id: "consultant", source_ids_json: "[]", created_at: "2026-10-01",
});

test("each value keeps its review when another set is corrected", () => {
  const first = value("first");
  const second = value("second");
  const reviews = [
    review(valueReviewSubject(first, statements), "approved", "Primero aprobado"),
    review(valueReviewSubject(second, statements), "changes_requested", "Precisar la conducta"),
  ];

  assert.equal(resolveValueReview(first, statements, reviews)?.record.status, "approved");
  assert.equal(resolveValueReview(second, statements, reviews)?.record.rationale, "Precisar la conducta");
  assert.equal(resolveValueReview(value("second", 2), statements, reviews), null);
  assert.equal(lastIndividualValueReview(value("second", 2), reviews)?.rationale, "Precisar la conducta");
  assert.equal(resolveValueReview(first, statements, reviews)?.record.status, "approved");
});

test("an old collection approval remains valid only for unchanged sets", () => {
  const first = value("first");
  const second = value("second");
  const legacySubject = [
    "first:v1", "second:v1", "mission:v1", "vision:v1",
  ].sort().join("|");
  const oldApproval = review(legacySubject, "approved", "Conjunto aprobado", "philosophy.values");

  assert.equal(resolveValueReview(first, statements, [oldApproval])?.origin, "legacy_group");
  assert.equal(resolveValueReview(second, statements, [oldApproval])?.record.status, "approved");
  assert.equal(resolveValueReview(value("second", 2), statements, [oldApproval]), null);
  assert.equal(resolveValueReview(first, statements, [oldApproval])?.record.status, "approved");
  assert.equal(resolveValueReview(first, [{ id: "mission", version: 2 }, statements[1]], [oldApproval]), null);
});

test("a later legacy request for changes is not overridden by an older approval", () => {
  const subject = ["first:v1", "mission:v1", "vision:v1"].sort().join("|");
  const reviews = [
    review(subject, "changes_requested", "Aclarar vínculo", "philosophy.values"),
    review(subject, "approved", "Aprobación anterior", "philosophy.values"),
  ];
  assert.equal(resolveValueReview(value("first"), statements, reviews), null);
});
