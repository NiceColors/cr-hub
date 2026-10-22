CREATE TABLE `bitbucket_credentials` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`email` text NOT NULL,
	`api_token` text NOT NULL,
	`updated_at` integer NOT NULL
);
