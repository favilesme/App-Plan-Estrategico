CREATE TABLE `foda_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`factor_id` text NOT NULL,
	`evidence_type` text NOT NULL,
	`statement` text NOT NULL,
	`source_type` text NOT NULL,
	`source_detail` text NOT NULL,
	`period` text NOT NULL,
	`diagnostic_input_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`factor_id`) REFERENCES `foda_factors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`diagnostic_input_id`) REFERENCES `diagnostic_inputs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_foda_evidence_factor` ON `foda_evidence` (`factor_id`);--> statement-breakpoint
CREATE TABLE `foda_factors` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`axis` text NOT NULL,
	`code` text NOT NULL,
	`sequence` integer NOT NULL,
	`description` text NOT NULL,
	`area` text NOT NULL,
	`classification_reason` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`set_id`) REFERENCES `foda_sets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_foda_factor_cycle_code` ON `foda_factors` (`cycle_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_foda_factor_set_axis` ON `foda_factors` (`set_id`,`axis`,`status`);--> statement-breakpoint
CREATE TABLE `foda_set_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`validation_ids_json` text NOT NULL,
	`consultant_approval_id` text,
	`methodology_version` text NOT NULL,
	`frozen_by_user_id` text NOT NULL,
	`frozen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`set_id`) REFERENCES `foda_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_foda_snapshot_set_version` ON `foda_set_snapshots` (`set_id`,`version`);--> statement-breakpoint
CREATE TABLE `foda_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`frozen_at` text,
	`frozen_by_user_id` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_foda_sets_cycle` ON `foda_sets` (`cycle_id`);--> statement-breakpoint
CREATE TABLE `foda_validations` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`set_version` integer NOT NULL,
	`revision` integer NOT NULL,
	`member_id` text NOT NULL,
	`decision` text NOT NULL,
	`rationale` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`set_id`) REFERENCES `foda_sets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_foda_validation_set_revision` ON `foda_validations` (`set_id`,`set_version`,`revision`);