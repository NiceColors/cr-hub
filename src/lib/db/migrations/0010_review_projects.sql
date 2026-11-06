ALTER TABLE `test_reports` ADD `project_id` integer REFERENCES `projects`(`id`);
--> statement-breakpoint
CREATE INDEX `test_reports_project_idx` ON `test_reports` (`project_id`);
