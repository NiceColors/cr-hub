CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_pull_requests` (
	`project_id` integer NOT NULL,
	`pr_key` text NOT NULL,
	`repo_uuid` text NOT NULL,
	`pr_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`repo_slug` text NOT NULL,
	`author_name` text,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `pr_key`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_pull_requests_pr_key_idx` ON `project_pull_requests` (`pr_key`);
