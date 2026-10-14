CREATE TABLE `foda_vulnerabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`matrix_id` text NOT NULL,
	`weakness_factor_id` text NOT NULL,
	`impact` text NOT NULL,
	`probability` text NOT NULL,
	`action_capacity` text NOT NULL,
	`rationale` text NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`matrix_id`) REFERENCES `foda_matrix_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weakness_factor_id`) REFERENCES `foda_factors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_foda_vulnerability_weakness` ON `foda_vulnerabilities` (`matrix_id`,`weakness_factor_id`);