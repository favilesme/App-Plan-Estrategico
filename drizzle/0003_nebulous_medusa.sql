CREATE TABLE `foda_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`set_version` integer NOT NULL,
	`factor_id` text NOT NULL,
	`member_id` text NOT NULL,
	`reason` text NOT NULL,
	`proposed_change` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`set_id`) REFERENCES `foda_sets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`factor_id`) REFERENCES `foda_factors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_foda_change_requests_set_version` ON `foda_change_requests` (`set_id`,`set_version`);