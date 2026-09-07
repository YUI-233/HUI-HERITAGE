import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Cloud D1 schema for the public HUI HERITAGE reading surface.
 *
 * The local PostgreSQL/Prisma schema remains authoritative while migration is
 * in progress. These tables deliberately store searchable data and metadata;
 * media bytes belong in the HUI_MEDIA R2 bucket.
 */
export const cloudCatalogRecords = sqliteTable(
  "cloud_catalog_records",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["manuscript", "artifact"] }).notNull(),
    catalogNumber: text("catalog_number"),
    title: text("title").notNull(),
    language: text("language"),
    author: text("author"),
    era: text("era"),
    category: text("category"),
    material: text("material"),
    description: text("description"),
    source: text("source"),
    status: text("status").notNull().default("APPROVED"),
    keywordsJson: text("keywords_json").notNull().default("[]"),
    metadataJson: text("metadata_json").notNull().default("[]"),
    submittedByUserId: text("submitted_by_user_id"),
    reviewedByUserId: text("reviewed_by_user_id"),
    reviewComment: text("review_comment"),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_cloud_catalog_status_type").on(table.status, table.type),
    index("idx_cloud_catalog_title").on(table.title),
    index("idx_cloud_catalog_catalog_number").on(table.catalogNumber),
  ],
);

export const cloudHoldings = sqliteTable(
  "cloud_holdings",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    recordType: text("record_type", { enum: ["manuscript", "artifact"] }).notNull(),
    recordJson: text("record_json").notNull().default("{}"),
    institution: text("institution").notNull(),
    region: text("region").notNull(),
    origin: text("origin", { enum: ["DOMESTIC", "OVERSEAS"] }).notNull(),
    callNumber: text("call_number"),
    catalogUrl: text("catalog_url"),
    description: text("description"),
    status: text("status").notNull().default("APPROVED"),
    submittedByUserId: text("submitted_by_user_id"),
    reviewedByUserId: text("reviewed_by_user_id"),
    reviewComment: text("review_comment"),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_cloud_holdings_status_origin_region").on(table.status, table.origin, table.region),
    index("idx_cloud_holdings_record").on(table.recordId, table.status),
    index("idx_cloud_holdings_institution").on(table.institution),
  ],
);

export const cloudResearchArticles = sqliteTable(
  "cloud_research_articles",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    author: text("author"),
    affiliation: text("affiliation"),
    publication: text("publication"),
    publishedYear: text("published_year"),
    volumeIssue: text("volume_issue"),
    pages: text("pages"),
    identifier: text("identifier"),
    summary: text("summary").notNull(),
    contentHtml: text("content_html").notNull().default(""),
    category: text("category").notNull(),
    status: text("status").notNull().default("APPROVED"),
    keywordsJson: text("keywords_json").notNull().default("[]"),
    relatedRecordIdsJson: text("related_record_ids_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_cloud_research_status_category").on(table.status, table.category),
    index("idx_cloud_research_title").on(table.title),
  ],
);

export const cloudMediaAssets = sqliteTable(
  "cloud_media_assets",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    visibility: text("visibility", { enum: ["PUBLIC", "MEMBER_ONLY", "PRIVATE"] }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_cloud_media_record").on(table.recordId, table.sortOrder)],
);

export const cloudSiteSettings = sqliteTable("cloud_site_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Cloud identities are linked to the stable GPT Sites user id, never to a browser cookie. */
export const cloudUsers = sqliteTable(
  "cloud_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    displayName: text("display_name"),
    role: text("role", { enum: ["MEMBER", "COLLECTOR", "SUPER_ADMIN"] }).notNull().default("MEMBER"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_cloud_users_active_role").on(table.isActive, table.role)],
);

export const cloudUserPermissions = sqliteTable(
  "cloud_user_permissions",
  {
    userId: text("user_id").notNull().references(() => cloudUsers.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (table) => [index("idx_cloud_user_permissions_user").on(table.userId), index("idx_cloud_user_permissions_permission").on(table.permission)],
);

export const cloudAuditEvents = sqliteTable(
  "cloud_audit_events",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    actorId: text("actor_id"),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_cloud_audit_entity").on(table.entityType, table.entityId), index("idx_cloud_audit_created").on(table.createdAt)],
);
