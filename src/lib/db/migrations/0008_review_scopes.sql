PRAGMA foreign_keys=OFF;
--> statement-breakpoint
ALTER TABLE `test_evidence` RENAME TO `test_evidence_old`;
--> statement-breakpoint
ALTER TABLE `test_findings` RENAME TO `test_findings_old`;
--> statement-breakpoint
ALTER TABLE `test_reports` RENAME TO `test_reports_old`;
--> statement-breakpoint
CREATE TABLE `test_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text DEFAULT 'cr' NOT NULL,
	`title` text NOT NULL,
	`pr_key` text,
	`repo_uuid` text,
	`pr_id` integer,
	`url` text DEFAULT '' NOT NULL,
	`repo_slug` text DEFAULT '' NOT NULL,
	`jira_key` text,
	`outcome` text DEFAULT 'partial' NOT NULL,
	`how_tested` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `test_reports` (
	`scope`, `title`, `pr_key`, `repo_uuid`, `pr_id`, `url`, `repo_slug`, `jira_key`, `outcome`, `how_tested`, `updated_at`
)
SELECT
	'cr', `title`, `pr_key`, `repo_uuid`, `pr_id`, `url`, `repo_slug`, `jira_key`, `outcome`, `how_tested`, `updated_at`
FROM `test_reports_old`;
--> statement-breakpoint
CREATE TABLE `test_findings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `test_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `test_findings` (`id`, `report_id`, `kind`, `body`, `sort_order`)
SELECT `f`.`id`, `r`.`id`, `f`.`kind`, `f`.`body`, `f`.`sort_order`
FROM `test_findings_old` `f`
INNER JOIN `test_reports` `r` ON `r`.`pr_key` = `f`.`pr_key`;
--> statement-breakpoint
CREATE TABLE `test_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`finding_id` integer,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `test_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`finding_id`) REFERENCES `test_findings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `test_evidence` (
	`id`, `report_id`, `finding_id`, `file_name`, `content_type`, `caption`, `sort_order`, `created_at`
)
SELECT `e`.`id`, `r`.`id`, `e`.`finding_id`, `e`.`file_name`, `e`.`content_type`, `e`.`caption`, `e`.`sort_order`, `e`.`created_at`
FROM `test_evidence_old` `e`
INNER JOIN `test_reports` `r` ON `r`.`pr_key` = `e`.`pr_key`;
--> statement-breakpoint
CREATE TABLE `test_report_members` (
	`report_id` integer NOT NULL,
	`pr_key` text NOT NULL,
	`repo_uuid` text NOT NULL,
	`pr_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`repo_slug` text NOT NULL,
	PRIMARY KEY(`report_id`, `pr_key`),
	FOREIGN KEY (`report_id`) REFERENCES `test_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `test_report_members` (`report_id`, `pr_key`, `repo_uuid`, `pr_id`, `title`, `url`, `repo_slug`)
SELECT `id`, `pr_key`, `repo_uuid`, `pr_id`, `title`, `url`, `repo_slug`
FROM `test_reports`
WHERE `pr_key` IS NOT NULL AND `repo_uuid` IS NOT NULL AND `pr_id` IS NOT NULL;
--> statement-breakpoint
DROP TABLE `test_evidence_old`;
--> statement-breakpoint
DROP TABLE `test_findings_old`;
--> statement-breakpoint
DROP TABLE `test_reports_old`;
--> statement-breakpoint
CREATE INDEX `test_reports_pr_key_idx` ON `test_reports` (`pr_key`);
--> statement-breakpoint
CREATE INDEX `test_reports_updated_idx` ON `test_reports` (`updated_at`);
--> statement-breakpoint
CREATE INDEX `test_report_members_pr_key_idx` ON `test_report_members` (`pr_key`);
--> statement-breakpoint
CREATE INDEX `test_findings_report_idx` ON `test_findings` (`report_id`);
--> statement-breakpoint
CREATE INDEX `test_evidence_report_idx` ON `test_evidence` (`report_id`);
