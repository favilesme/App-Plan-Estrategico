import assert from "node:assert/strict";
import test from "node:test";
import { actionPriorityConflict, statedActionPriority } from "../lib/action-priority.ts";

test("detects a stated action priority and keeps FODA scores separate", () => {
  assert.equal(statedActionPriority("Cruce F1×O1 = 9. Prioridad propuesta: 5/5"), 5);
  assert.equal(statedActionPriority("Cruce F1×O1 = 9"), null);
  assert.equal(actionPriorityConflict({ priority: 1, expected_effect: "Prioridad propuesta: 5/5", priority_rationale: "F1 es P1" }), true);
  assert.equal(actionPriorityConflict({ priority: 5, expected_effect: "Prioridad propuesta: 5/5", priority_rationale: "F1 es P1" }), false);
  assert.equal(actionPriorityConflict({ priority: 1, expected_effect: "Mejorar cobertura", priority_rationale: "F1 es P1" }), false);
});
