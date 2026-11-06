CREATE TABLE `review_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_key` text NOT NULL,
	`repo_uuid` text NOT NULL,
	`pr_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`repo_slug` text NOT NULL,
	`jira_key` text,
	`time_spent_ms` integer NOT NULL,
	`completed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_sessions_completed_idx` ON `review_sessions` (`completed_at`);
--> statement-breakpoint
CREATE INDEX `review_sessions_pr_key_idx` ON `review_sessions` (`pr_key`);
--> statement-breakpoint
CREATE TABLE `test_reports` (
	`pr_key` text PRIMARY KEY NOT NULL,
	`repo_uuid` text NOT NULL,
	`pr_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`repo_slug` text NOT NULL,
	`jira_key` text,
	`outcome` text DEFAULT 'partial' NOT NULL,
	`how_tested` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_findings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_key` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`pr_key`) REFERENCES `test_reports`(`pr_key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `test_findings_pr_key_idx` ON `test_findings` (`pr_key`);
--> statement-breakpoint
CREATE TABLE `test_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_key` text NOT NULL,
	`finding_id` integer,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pr_key`) REFERENCES `test_reports`(`pr_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`finding_id`) REFERENCES `test_findings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `test_evidence_pr_key_idx` ON `test_evidence` (`pr_key`);
--> statement-breakpoint
INSERT INTO `review_sessions` (
	`pr_key`,
	`repo_uuid`,
	`pr_id`,
	`title`,
	`url`,
	`repo_slug`,
	`jira_key`,
	`time_spent_ms`,
	`completed_at`
)
SELECT
	`pr_key`,
	`repo_uuid`,
	`pr_id`,
	`title`,
	`url`,
	`repo_slug`,
	NULL,
	`time_spent_ms`,
	`done_at`
FROM `focus_items`
WHERE `done_at` IS NOT NULL;
