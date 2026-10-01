CREATE TABLE `diagnostic_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`area` text NOT NULL,
	`classification` text NOT NULL,
	`statement` text NOT NULL,
	`source_type` text NOT NULL,
	`source_detail` text NOT NULL,
	`period` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_diagnostic_inputs_cycle_area` ON `diagnostic_inputs` (`cycle_id`,`area`);--> statement-breakpoint
CREATE TABLE `philosophy_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`question_key` text NOT NULL,
	`answer` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_philosophy_answer_question` ON `philosophy_answers` (`cycle_id`,`question_key`);--> statement-breakpoint
CREATE TABLE `philosophy_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`kind` text NOT NULL,
	`statement` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_philosophy_statement_kind` ON `philosophy_statements` (`cycle_id`,`kind`);--> statement-breakpoint
CREATE TABLE `project_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`scope` text DEFAULT '' NOT NULL,
	`calendar_notes` text DEFAULT '' NOT NULL,
	`primary_sources` text DEFAULT '' NOT NULL,
	`secondary_sources` text DEFAULT '' NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_project_profiles_cycle` ON `project_profiles` (`cycle_id`);--> statement-breakpoint
CREATE TABLE `value_behaviors` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`value_name` text NOT NULL,
	`behavior` text NOT NULL,
	`mission_link` text,
	`vision_link` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_value_behaviors_cycle` ON `value_behaviors` (`cycle_id`);