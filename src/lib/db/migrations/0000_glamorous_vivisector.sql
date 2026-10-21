CREATE TABLE `monitored_repos` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `monitored_users` (
	`uuid` text PRIMARY KEY NOT NULL,
	`nickname` text,
	`display_name` text,
	`avatar_url` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`refresh_interval_sec` integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `squad_members` (
	`squad_id` integer NOT NULL,
	`user_uuid` text NOT NULL,
	PRIMARY KEY(`squad_id`, `user_uuid`),
	FOREIGN KEY (`squad_id`) REFERENCES `squads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_uuid`) REFERENCES `monitored_users`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `squad_repo_filters` (
	`squad_id` integer NOT NULL,
	`repo_slug` text NOT NULL,
	PRIMARY KEY(`squad_id`, `repo_slug`),
	FOREIGN KEY (`squad_id`) REFERENCES `squads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repo_slug`) REFERENCES `monitored_repos`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `squads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `squads_name_unique` ON `squads` (`name`);