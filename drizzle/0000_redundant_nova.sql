CREATE TABLE `cloud_catalog_records` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`catalog_number` text,
	`title` text NOT NULL,
	`language` text,
	`author` text,
	`era` text,
	`category` text,
	`material` text,
	`description` text,
	`source` text,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`metadata_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cloud_catalog_status_type` ON `cloud_catalog_records` (`status`,`type`);--> statement-breakpoint
CREATE INDEX `idx_cloud_catalog_title` ON `cloud_catalog_records` (`title`);--> statement-breakpoint
CREATE INDEX `idx_cloud_catalog_catalog_number` ON `cloud_catalog_records` (`catalog_number`);--> statement-breakpoint
CREATE TABLE `cloud_holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`record_type` text NOT NULL,
	`institution` text NOT NULL,
	`region` text NOT NULL,
	`origin` text NOT NULL,
	`call_number` text,
	`catalog_url` text,
	`description` text,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cloud_holdings_status_origin_region` ON `cloud_holdings` (`status`,`origin`,`region`);--> statement-breakpoint
CREATE INDEX `idx_cloud_holdings_record` ON `cloud_holdings` (`record_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_cloud_holdings_institution` ON `cloud_holdings` (`institution`);--> statement-breakpoint
CREATE TABLE `cloud_media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`visibility` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cloud_media_assets_storage_key_unique` ON `cloud_media_assets` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_cloud_media_record` ON `cloud_media_assets` (`record_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `cloud_research_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`affiliation` text,
	`publication` text,
	`published_year` text,
	`volume_issue` text,
	`pages` text,
	`identifier` text,
	`summary` text NOT NULL,
	`content_html` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`related_record_ids_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cloud_research_status_category` ON `cloud_research_articles` (`status`,`category`);--> statement-breakpoint
CREATE INDEX `idx_cloud_research_title` ON `cloud_research_articles` (`title`);--> statement-breakpoint
CREATE TABLE `cloud_site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
