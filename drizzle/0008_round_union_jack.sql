CREATE TABLE `execution_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`initiative_id` text NOT NULL,
	`initiative_version` integer NOT NULL,
	`objective_id` text NOT NULL,
	`objective_version` integer NOT NULL,
	`responsible_member_id` text,
	`start_date` text,
	`end_date` text,
	`milestones_json` text DEFAULT '[]' NOT NULL,
	`resources` text DEFAULT '' NOT NULL,
	`risks` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`initiative_id`) REFERENCES `strategic_initiatives`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`objective_id`) REFERENCES `strategic_objectives`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responsible_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_execution_initiative` ON `execution_plans` (`initiative_id`);--> statement-breakpoint
CREATE INDEX `idx_execution_cycle` ON `execution_plans` (`cycle_id`);--> statement-breakpoint
CREATE TABLE `kpi_specs` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`objective_id` text NOT NULL,
	`objective_version` integer NOT NULL,
	`formula` text DEFAULT '' NOT NULL,
	`denominator` text DEFAULT '' NOT NULL,
	`requires_denominator` integer DEFAULT false NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`baseline` text DEFAULT '' NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`frequency` text DEFAULT '' NOT NULL,
	`responsible_member_id` text,
	`direction` text DEFAULT '' NOT NULL,
	`tolerance` text DEFAULT '' NOT NULL,
	`tolerance_rationale` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`objective_id`) REFERENCES `strategic_objectives`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responsible_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_kpi_objective` ON `kpi_specs` (`objective_id`);--> statement-breakpoint
CREATE INDEX `idx_kpi_cycle` ON `kpi_specs` (`cycle_id`);