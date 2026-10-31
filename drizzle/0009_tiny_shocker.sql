CREATE TABLE `area_scorecards` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`name` text NOT NULL,
	`objective_ids_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_scorecards_cycle` ON `area_scorecards` (`cycle_id`);--> statement-breakpoint
CREATE TABLE `budget_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`period_key` text NOT NULL,
	`amount` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT '' NOT NULL,
	`source_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `execution_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_budget_plan_period` ON `budget_entries` (`plan_id`,`period_key`);--> statement-breakpoint
CREATE INDEX `idx_budget_cycle` ON `budget_entries` (`cycle_id`);