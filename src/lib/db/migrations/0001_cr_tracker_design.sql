PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DROP TABLE IF EXISTS `squad_members`;
--> statement-breakpoint
DROP TABLE IF EXISTS `squad_repo_filters`;
--> statement-breakpoint
DROP TABLE IF EXISTS `squads`;
--> statement-breakpoint
DROP TABLE IF EXISTS `monitored_users`;
--> statement-breakpoint
DROP TABLE IF EXISTS `monitored_repos`;
--> statement-breakpoint
DROP TABLE IF EXISTS `settings`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint

CREATE TABLE `repositories` (
	`uuid` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`monitored` integer DEFAULT false NOT NULL,
	`min_approvals` integer DEFAULT 1 NOT NULL,
	`synced_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repositories_slug_unique` ON `repositories` (`slug`);
--> statement-breakpoint

CREATE TABLE `members` (
	`uuid` text PRIMARY KEY NOT NULL,
	`nickname` text,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`monitored` integer DEFAULT false NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (`name`);
--> statement-breakpoint

CREATE TABLE `team_members` (
	`team_id` integer NOT NULL,
	`member_uuid` text NOT NULL,
	PRIMARY KEY(`team_id`, `member_uuid`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_uuid`) REFERENCES `members`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `team_repositories` (
	`team_id` integer NOT NULL,
	`repository_uuid` text NOT NULL,
	PRIMARY KEY(`team_id`, `repository_uuid`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repository_uuid`) REFERENCES `repositories`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`poll_interval_seconds` integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
INSERT INTO `settings` (`id`, `poll_interval_seconds`) VALUES (1, 30);