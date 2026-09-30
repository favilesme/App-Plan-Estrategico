CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`gate_key` text NOT NULL,
	`subject_id` text NOT NULL,
	`status` text NOT NULL,
	`reviewer_user_id` text NOT NULL,
	`rationale` text NOT NULL,
	`source_ids_json` text DEFAULT '[]' NOT NULL,
	`methodology_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_approvals_subject` ON `approvals` (`cycle_id`,`gate_key`,`subject_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`cycle_id` text,
	`actor_user_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`event_type` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_org_created` ON `audit_events` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `evidence_files` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_evidence_r2_key` ON `evidence_files` (`r2_key`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`auth_user_id` text,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`is_leader` integer DEFAULT false NOT NULL,
	`is_director` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_members_org_email` ON `members` (`organization_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_members_auth_user` ON `members` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `module_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`module_slug` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`percent` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`updated_by_user_id` text,
	`approved_by_user_id` text,
	`approved_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `strategy_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_progress_cycle_module` ON `module_progress` (`cycle_id`,`module_slug`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sector` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `strategy_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`methodology_version` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cycles_organization` ON `strategy_cycles` (`organization_id`);