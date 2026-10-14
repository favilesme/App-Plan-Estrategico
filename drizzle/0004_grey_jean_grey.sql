CREATE TABLE `foda_cross_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`matrix_id` text NOT NULL,
	`quadrant` text NOT NULL,
	`internal_factor_id` text NOT NULL,
	`external_factor_id` text NOT NULL,
	`suggested_score` integer,
	`suggested_rationale` text,
	`suggested_evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`final_score` integer,
	`final_rationale` text,
	`final_evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`updated_by_user_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`matrix_id`) REFERENCES `foda_matrix_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`internal_factor_id`) REFERENCES `foda_factors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`external_factor_id`) REFERENCES `foda_factors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_foda_cross_pair` ON `foda_cross_scores` (`matrix_id`,`quadrant`,`internal_factor_id`,`external_factor_id`);--> statement-breakpoint
CREATE INDEX `idx_foda_cross_matrix_quadrant` ON `foda_cross_scores` (`matrix_id`,`quadrant`);--> statement-breakpoint
CREATE TABLE `foda_matrix_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`set_version` integer NOT NULL,
	`matrix_version` integer NOT NULL,
	`source_snapshot_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`approved_by_user_id` text,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`set_id`) REFERENCES `foda_sets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_snapshot_id`) REFERENCES `foda_set_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_foda_matrix_version` ON `foda_matrix_versions` (`set_id`,`set_version`,`matrix_version`);--> statement-breakpoint
CREATE INDEX `idx_foda_matrix_set` ON `foda_matrix_versions` (`set_id`,`set_version`,`status`);--> statement-breakpoint
CREATE TABLE `foda_matrix_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`matrix_id` text NOT NULL,
	`matrix_revision` integer NOT NULL,
	`member_id` text NOT NULL,
	`decision` text NOT NULL,
	`rationale` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`matrix_id`) REFERENCES `foda_matrix_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_foda_matrix_votes_revision` ON `foda_matrix_votes` (`matrix_id`,`matrix_revision`);--> statement-breakpoint
CREATE TABLE `foda_qualitative_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`matrix_id` text NOT NULL,
	`quadrant` text NOT NULL,
	`narrative` text NOT NULL,
	`factor_ids_json` text DEFAULT '[]' NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`matrix_id`) REFERENCES `foda_matrix_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_foda_qualitative_quadrant` ON `foda_qualitative_notes` (`matrix_id`,`quadrant`);