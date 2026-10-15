CREATE TABLE `mdep_affinities` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`action_id` text NOT NULL,
	`direction` text NOT NULL,
	`score` integer NOT NULL,
	`rationale` text NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `mdep_assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`action_id`) REFERENCES `strategic_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mdep_affinity` ON `mdep_affinities` (`assessment_id`,`action_id`,`direction`);--> statement-breakpoint
CREATE TABLE `mdep_affinity_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`action_id` text NOT NULL,
	`suggestions_json` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `mdep_assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`action_id`) REFERENCES `strategic_actions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mdep_ai_action` ON `mdep_affinity_drafts` (`assessment_id`,`action_id`);--> statement-breakpoint
CREATE TABLE `mdep_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`action_set_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`competitive_context` text DEFAULT '' NOT NULL,
	`choice_direction` text,
	`choice_rationale` text,
	`focus_segment` text,
	`focus_advantage` text,
	`focus_exclusions` text,
	`approved_by_user_id` text,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`action_set_id`) REFERENCES `strategic_action_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mdep_action_set` ON `mdep_assessments` (`action_set_id`);--> statement-breakpoint
CREATE TABLE `mdep_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`direction` text NOT NULL,
	`status` text NOT NULL,
	`rationale` text NOT NULL,
	`source_detail` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `mdep_assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mdep_condition` ON `mdep_conditions` (`assessment_id`,`direction`);--> statement-breakpoint
CREATE TABLE `mdep_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`scope` text DEFAULT 'general' NOT NULL,
	`direction` text NOT NULL,
	`criterion_key` text NOT NULL,
	`score` integer NOT NULL,
	`rationale` text NOT NULL,
	`source_detail` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `mdep_assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mdep_criterion` ON `mdep_criteria` (`assessment_id`,`scope`,`direction`,`criterion_key`);--> statement-breakpoint
CREATE TABLE `mdep_direction_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`direction` text NOT NULL,
	`advantages` text NOT NULL,
	`risks` text NOT NULL,
	`required_capabilities` text NOT NULL,
	`operational_implications` text NOT NULL,
	`market_coherence` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `mdep_assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mdep_direction_brief` ON `mdep_direction_briefs` (`assessment_id`,`direction`);--> statement-breakpoint
CREATE TABLE `mdep_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`assessment_revision` integer NOT NULL,
	`member_id` text NOT NULL,
	`direction` text NOT NULL,
	`rationale` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `mdep_assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mdep_votes_revision` ON `mdep_votes` (`assessment_id`,`assessment_revision`);--> statement-breakpoint
CREATE TABLE `strategic_action_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`matrix_id` text NOT NULL,
	`business_unit` text DEFAULT '' NOT NULL,
	`offer` text DEFAULT '' NOT NULL,
	`customers` text DEFAULT '' NOT NULL,
	`market` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`approved_by_user_id` text,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matrix_id`) REFERENCES `foda_matrix_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_action_set_matrix` ON `strategic_action_sets` (`matrix_id`);--> statement-breakpoint
CREATE TABLE `strategic_action_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`action_set_id` text NOT NULL,
	`set_revision` integer NOT NULL,
	`member_id` text NOT NULL,
	`decision` text NOT NULL,
	`rationale` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`action_set_id`) REFERENCES `strategic_action_sets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_action_votes_revision` ON `strategic_action_votes` (`action_set_id`,`set_revision`);--> statement-breakpoint
CREATE TABLE `strategic_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`action_set_id` text NOT NULL,
	`quadrant` text NOT NULL,
	`statement` text NOT NULL,
	`expected_effect` text NOT NULL,
	`factor_ids_json` text DEFAULT '[]' NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`priority` integer,
	`priority_rationale` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`action_set_id`) REFERENCES `strategic_action_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_strategic_actions_set` ON `strategic_actions` (`action_set_id`);