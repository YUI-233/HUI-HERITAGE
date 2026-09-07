CREATE TABLE `cloud_user_permissions` (
	`user_id` text NOT NULL,
	`permission` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `cloud_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cloud_user_permissions_user` ON `cloud_user_permissions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_cloud_user_permissions_permission` ON `cloud_user_permissions` (`permission`);--> statement-breakpoint
CREATE TABLE `cloud_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'MEMBER' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cloud_users_email_unique` ON `cloud_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_cloud_users_active_role` ON `cloud_users` (`is_active`,`role`);