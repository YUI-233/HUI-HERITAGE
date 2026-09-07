CREATE TYPE "user_role" AS ENUM ('MEMBER', 'COLLECTOR', 'SUPER_ADMIN');
CREATE TYPE "review_status" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'ARCHIVED');
CREATE TYPE "media_visibility" AS ENUM ('PUBLIC', 'MEMBER_ONLY', 'PRIVATE');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "user_role" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "books" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "dynasty" TEXT,
  "version_type" TEXT,
  "description" TEXT,
  "source" TEXT,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "review_status" NOT NULL DEFAULT 'APPROVED',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "artifacts" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "era" TEXT,
  "material" TEXT,
  "description" TEXT,
  "source" TEXT,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "review_status" NOT NULL DEFAULT 'APPROVED',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_assets" (
  "id" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "visibility" "media_visibility" NOT NULL DEFAULT 'PRIVATE',
  "book_id" TEXT,
  "artifact_id" TEXT,
  "uploaded_by_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_owner_check" CHECK (("book_id" IS NOT NULL)::integer + ("artifact_id" IS NOT NULL)::integer <= 1)
);

CREATE TABLE "audit_events" (
  "id" BIGSERIAL NOT NULL,
  "entity_type" TEXT NOT NULL CHECK ("entity_type" IN ('BOOK', 'ARTIFACT', 'MEDIA_ASSET')),
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "actor_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");
CREATE INDEX "books_title_idx" ON "books" USING gin (to_tsvector('simple', "title"));
CREATE INDEX "artifacts_title_idx" ON "artifacts" USING gin (to_tsvector('simple', "title"));
CREATE INDEX "media_assets_book_idx" ON "media_assets"("book_id");
CREATE INDEX "media_assets_artifact_idx" ON "media_assets"("artifact_id");
CREATE INDEX "audit_events_entity_idx" ON "audit_events"("entity_type", "entity_id", "created_at" DESC);
CREATE INDEX "audit_events_actor_idx" ON "audit_events"("actor_id", "created_at" DESC);

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE VIEW "catalog_entries" AS
SELECT books.id, 'BOOK'::TEXT AS record_type, books.title, books.description, books.source,
  books.dynasty AS era, books.status::TEXT AS status, media_assets.storage_key,
  media_assets.visibility::TEXT AS visibility
FROM books LEFT JOIN media_assets ON media_assets.book_id = books.id
UNION ALL
SELECT artifacts.id, 'ARTIFACT'::TEXT AS record_type, artifacts.title, artifacts.description,
  artifacts.source, artifacts.era, artifacts.status::TEXT AS status, media_assets.storage_key,
  media_assets.visibility::TEXT AS visibility
FROM artifacts LEFT JOIN media_assets ON media_assets.artifact_id = artifacts.id;

CREATE VIEW "review_queue" AS
SELECT id, 'BOOK'::TEXT AS record_type, title, status::TEXT AS status, updated_at
FROM books WHERE status IN ('DRAFT', 'PENDING', 'NEEDS_REVISION')
UNION ALL
SELECT id, 'ARTIFACT'::TEXT AS record_type, title, status::TEXT AS status, updated_at
FROM artifacts WHERE status IN ('DRAFT', 'PENDING', 'NEEDS_REVISION');

CREATE FUNCTION "set_updated_at"() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "books_set_updated_at" BEFORE UPDATE ON "books"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "artifacts_set_updated_at" BEFORE UPDATE ON "artifacts"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE FUNCTION "audit_review_status_change"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_events (entity_type, entity_id, action, payload)
    VALUES (
      TG_ARGV[0],
      NEW.id,
      'STATUS_CHANGED',
      jsonb_build_object('previousStatus', OLD.status, 'nextStatus', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "books_review_status_audit" AFTER UPDATE ON "books"
FOR EACH ROW EXECUTE FUNCTION "audit_review_status_change"('BOOK');
CREATE TRIGGER "artifacts_review_status_audit" AFTER UPDATE ON "artifacts"
FOR EACH ROW EXECUTE FUNCTION "audit_review_status_change"('ARTIFACT');

CREATE FUNCTION "search_catalog"(search_text TEXT DEFAULT NULL, requested_type TEXT DEFAULT NULL)
RETURNS TABLE (id TEXT, record_type TEXT, title TEXT, description TEXT, source TEXT, era TEXT, status TEXT, storage_key TEXT, visibility TEXT) AS $$
  SELECT entries.id, entries.record_type, entries.title, entries.description, entries.source,
    entries.era, entries.status, entries.storage_key, entries.visibility
  FROM catalog_entries AS entries
  WHERE (requested_type IS NULL OR entries.record_type = requested_type)
    AND (search_text IS NULL OR search_text = '' OR concat_ws(' ', entries.title, entries.description, entries.source, entries.era) ILIKE '%' || search_text || '%')
  ORDER BY entries.title;
$$ LANGUAGE SQL STABLE;
