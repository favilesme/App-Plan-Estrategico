CREATE TABLE `strategic_initiatives` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`objective_id` text NOT NULL,
	`objective_version` integer NOT NULL,
	`source_action_id` text NOT NULL,
	`statement` text NOT NULL,
	`expected_result` text NOT NULL,
	`responsible_member_id` text NOT NULL,
	`evidence_note` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`objective_id`) REFERENCES `strategic_objectives`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_action_id`) REFERENCES `strategic_actions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responsible_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_initiatives_objective` ON `strategic_initiatives` (`objective_id`);--> statement-breakpoint
CREATE TABLE `strategic_objectives` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`perspective` text NOT NULL,
	`statement` text NOT NULL,
	`desired_result` text NOT NULL,
	`strategy_link` text NOT NULL,
	`source_action_ids_json` text NOT NULL,
	`evidence_ids_json` text NOT NULL,
	`evidence_note` text NOT NULL,
	`kpi_name` text NOT NULL,
	`kpi_unit` text NOT NULL,
	`kpi_definition` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assessment_id`) REFERENCES `mdep_assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_objectives_assessment` ON `strategic_objectives` (`assessment_id`);