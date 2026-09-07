CREATE TABLE `cloud_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cloud_audit_entity` ON `cloud_audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_cloud_audit_created` ON `cloud_audit_events` (`created_at`);--> statement-breakpoint
ALTER TABLE `cloud_catalog_records` ADD `submitted_by_user_id` text;--> statement-breakpoint
ALTER TABLE `cloud_catalog_records` ADD `reviewed_by_user_id` text;--> statement-breakpoint
ALTER TABLE `cloud_catalog_records` ADD `review_comment` text;--> statement-breakpoint
ALTER TABLE `cloud_catalog_records` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `cloud_holdings` ADD `submitted_by_user_id` text;--> statement-breakpoint
ALTER TABLE `cloud_holdings` ADD `reviewed_by_user_id` text;--> statement-breakpoint
ALTER TABLE `cloud_holdings` ADD `review_comment` text;--> statement-breakpoint
ALTER TABLE `cloud_holdings` ADD `reviewed_at` text;