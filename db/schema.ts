import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Sprint 1 persists identity, governance and cycle state. Method-specific entities
// will receive separate append-only migrations in their corresponding sprints.
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sector: text("sector"),
  createdByUserId: text("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const strategyCycles = sqliteTable("strategy_cycles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  methodologyVersion: text("methodology_version").notNull(),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_cycles_organization").on(table.organizationId)]);

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  authUserId: text("auth_user_id"),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  isLeader: integer("is_leader", { mode: "boolean" }).notNull().default(false),
  isDirector: integer("is_director", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("ux_members_org_email").on(table.organizationId, table.email),
  index("idx_members_auth_user").on(table.authUserId),
]);

export const moduleProgress = sqliteTable("module_progress", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  moduleSlug: text("module_slug").notNull(),
  status: text("status").notNull().default("not_started"),
  percent: integer("percent").notNull().default(0),
  summary: text("summary"),
  updatedByUserId: text("updated_by_user_id"),
  approvedByUserId: text("approved_by_user_id"),
  approvedAt: text("approved_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("ux_progress_cycle_module").on(table.cycleId, table.moduleSlug)]);

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  gateKey: text("gate_key").notNull(),
  subjectId: text("subject_id").notNull(),
  status: text("status").notNull(),
  reviewerUserId: text("reviewer_user_id").notNull(),
  rationale: text("rationale").notNull(),
  sourceIdsJson: text("source_ids_json").notNull().default("[]"),
  methodologyVersion: text("methodology_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_approvals_subject").on(table.cycleId, table.gateKey, table.subjectId)]);

export const evidenceFiles = sqliteTable("evidence_files", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  r2Key: text("r2_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedByUserId: text("uploaded_by_user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("ux_evidence_r2_key").on(table.r2Key)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  cycleId: text("cycle_id").references(() => strategyCycles.id),
  actorUserId: text("actor_user_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  eventType: text("event_type").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_org_created").on(table.organizationId, table.createdAt)]);

// Sprint 2 keeps workshop answers, approved statements and diagnostic inputs
// distinct. Edits retain their previous value in audit_events.
export const projectProfiles = sqliteTable("project_profiles", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  scope: text("scope").notNull().default(""),
  calendarNotes: text("calendar_notes").notNull().default(""),
  primarySources: text("primary_sources").notNull().default(""),
  secondarySources: text("secondary_sources").notNull().default(""),
  updatedByUserId: text("updated_by_user_id").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("ux_project_profiles_cycle").on(table.cycleId)]);

export const philosophyAnswers = sqliteTable("philosophy_answers", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  questionKey: text("question_key").notNull(),
  answer: text("answer").notNull(),
  version: integer("version").notNull().default(1),
  updatedByUserId: text("updated_by_user_id").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("ux_philosophy_answer_question").on(table.cycleId, table.questionKey)]);

export const philosophyStatements = sqliteTable("philosophy_statements", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  kind: text("kind").notNull(),
  statement: text("statement").notNull(),
  version: integer("version").notNull().default(1),
  updatedByUserId: text("updated_by_user_id").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("ux_philosophy_statement_kind").on(table.cycleId, table.kind)]);

export const valueBehaviors = sqliteTable("value_behaviors", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  valueName: text("value_name").notNull(),
  behavior: text("behavior").notNull(),
  missionLink: text("mission_link"),
  visionLink: text("vision_link"),
  version: integer("version").notNull().default(1),
  updatedByUserId: text("updated_by_user_id").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_value_behaviors_cycle").on(table.cycleId)]);

export const diagnosticInputs = sqliteTable("diagnostic_inputs", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  area: text("area").notNull(),
  classification: text("classification").notNull(),
  statement: text("statement").notNull(),
  sourceType: text("source_type").notNull(),
  sourceDetail: text("source_detail").notNull(),
  period: text("period").notNull(),
  version: integer("version").notNull().default(1),
  createdByUserId: text("created_by_user_id").notNull(),
  updatedByUserId: text("updated_by_user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_diagnostic_inputs_cycle_area").on(table.cycleId, table.area)]);

// Sprint 3 separates working factors, their source evidence and the immutable
// lists approved for later matrices. Historical list snapshots are never edited.
export const fodaSets = sqliteTable("foda_sets", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  version: integer("version").notNull().default(1),
  revision: integer("revision").notNull().default(0),
  status: text("status").notNull().default("draft"),
  frozenAt: text("frozen_at"),
  frozenByUserId: text("frozen_by_user_id"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("ux_foda_sets_cycle").on(table.cycleId)]);

export const fodaFactors = sqliteTable("foda_factors", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => fodaSets.id),
  cycleId: text("cycle_id").notNull().references(() => strategyCycles.id),
  axis: text("axis").notNull(),
  code: text("code").notNull(),
  sequence: integer("sequence").notNull(),
  description: text("description").notNull(),
  area: text("area").notNull(),
  classificationReason: text("classification_reason").notNull(),
  status: text("status").notNull().default("proposed"),
  version: integer("version").notNull().default(1),
  createdByUserId: text("created_by_user_id").notNull(),
  updatedByUserId: text("updated_by_user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("ux_foda_factor_cycle_code").on(table.cycleId, table.code),
  index("idx_foda_factor_set_axis").on(table.setId, table.axis, table.status),
]);

export const fodaEvidence = sqliteTable("foda_evidence", {
  id: text("id").primaryKey(),
  factorId: text("factor_id").notNull().references(() => fodaFactors.id),
  evidenceType: text("evidence_type").notNull(),
  statement: text("statement").notNull(),
  sourceType: text("source_type").notNull(),
  sourceDetail: text("source_detail").notNull(),
  period: text("period").notNull(),
  diagnosticInputId: text("diagnostic_input_id").references(() => diagnosticInputs.id),
  version: integer("version").notNull().default(1),
  createdByUserId: text("created_by_user_id").notNull(),
  updatedByUserId: text("updated_by_user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_foda_evidence_factor").on(table.factorId)]);

export const fodaValidations = sqliteTable("foda_validations", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => fodaSets.id),
  setVersion: integer("set_version").notNull(),
  revision: integer("revision").notNull(),
  memberId: text("member_id").notNull().references(() => members.id),
  decision: text("decision").notNull(),
  rationale: text("rationale").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_foda_validation_set_revision").on(table.setId, table.setVersion, table.revision)]);

export const fodaSetSnapshots = sqliteTable("foda_set_snapshots", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => fodaSets.id),
  version: integer("version").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  validationIdsJson: text("validation_ids_json").notNull(),
  consultantApprovalId: text("consultant_approval_id"),
  methodologyVersion: text("methodology_version").notNull(),
  frozenByUserId: text("frozen_by_user_id").notNull(),
  frozenAt: text("frozen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("ux_foda_snapshot_set_version").on(table.setId, table.version)]);

// A correction request does not alter an approved factor. Direction decides
// whether to reopen the frozen set; the request remains available for audit.
export const fodaChangeRequests = sqliteTable("foda_change_requests", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => fodaSets.id),
  setVersion: integer("set_version").notNull(),
  factorId: text("factor_id").notNull().references(() => fodaFactors.id),
  memberId: text("member_id").notNull().references(() => members.id),
  reason: text("reason").notNull(),
  proposedChange: text("proposed_change").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_foda_change_requests_set_version").on(table.setId, table.setVersion)]);
