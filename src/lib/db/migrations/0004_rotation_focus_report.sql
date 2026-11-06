ALTER TABLE `pr_history` ADD `title` text;
--> statement-breakpoint
ALTER TABLE `pr_history` ADD `url` text;
--> statement-breakpoint
ALTER TABLE `pr_history` ADD `repo_slug` text;
--> statement-breakpoint
ALTER TABLE `pr_history` ADD `author_name` text;
--> statement-breakpoint
ALTER TABLE `pr_history` ADD `last_review_state` text;
--> statement-breakpoint
ALTER TABLE `pr_history` ADD `changes_cycles` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `pr_history` ADD `review_tracked_from_start` integer DEFAULT false NOT NULL;
--> statement-breakpoint

CREATE TABLE `team_rotations` (
	`team_id` integer PRIMARY KEY NOT NULL,
	`member_uuids` text NOT NULL,
	`start_date` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `focus_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_key` text NOT NULL,
	`repo_uuid` text NOT NULL,
	`pr_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`repo_slug` text NOT NULL,
	`added_at` integer NOT NULL,
	`time_spent_ms` integer DEFAULT 0 NOT NULL,
	`timer_started_at` integer,
	`done_at` integer
);
--> statement-breakpoint
CREATE INDEX `focus_items_active_idx` ON `focus_items` (`done_at`, `pr_key`);
