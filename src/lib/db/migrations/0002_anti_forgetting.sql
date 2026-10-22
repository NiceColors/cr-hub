ALTER TABLE `repositories` ADD `sla_warning_hours` integer;
--> statement-breakpoint
ALTER TABLE `repositories` ADD `sla_critical_hours` integer;
--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_base_url` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_project_keys` text;
--> statement-breakpoint

CREATE TABLE `snoozes` (
	`pr_key` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`kind` text NOT NULL,
	`until_ms` integer,
	`until_updated_on` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `saved_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`tab` text NOT NULL,
	`team_id` integer,
	`filter_query` text NOT NULL,
	`show_snoozed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_views_name_unique` ON `saved_views` (`name`);
--> statement-breakpoint

CREATE TABLE `pr_diffstats` (
	`repo_uuid` text NOT NULL,
	`pr_id` integer NOT NULL,
	`updated_on` text NOT NULL,
	`lines_added` integer NOT NULL,
	`lines_removed` integer NOT NULL,
	`files_changed` integer NOT NULL,
	PRIMARY KEY(`repo_uuid`, `pr_id`)
);
--> statement-breakpoint

CREATE TABLE `pr_history` (
	`pr_key` text PRIMARY KEY NOT NULL,
	`repo_uuid` text NOT NULL,
	`pr_id` integer NOT NULL,
	`author_uuid` text NOT NULL,
	`destination_branch` text,
	`created_on` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`first_review_at` integer,
	`approved_at` integer,
	`last_seen_at` integer NOT NULL,
	`closed_at` integer
);
--> statement-breakpoint
CREATE INDEX `pr_history_repo_open_idx` ON `pr_history` (`repo_uuid`, `closed_at`);
--> statement-breakpoint

CREATE TABLE `queue_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`taken_at` integer NOT NULL,
	`total` integer NOT NULL,
	`warning` integer NOT NULL,
	`critical` integer NOT NULL,
	`approved` integer NOT NULL,
	`waiting` integer NOT NULL,
	`changes_requested` integer NOT NULL
);
