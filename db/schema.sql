DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('MEMBER', 'COLLECTOR', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE media_visibility AS ENUM ('PUBLIC', 'MEMBER_ONLY', 'PRIVATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE collection_origin AS ENUM ('DOMESTIC', 'OVERSEAS', 'PERSONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE workflow_lane AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  dynasty TEXT,
  version_type TEXT,
  description TEXT,
  source TEXT,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status review_status NOT NULL DEFAULT 'APPROVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  era TEXT,
  material TEXT,
  description TEXT,
  source TEXT,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status review_status NOT NULL DEFAULT 'APPROVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  visibility media_visibility NOT NULL DEFAULT 'PRIVATE',
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  artifact_id TEXT REFERENCES artifacts(id) ON DELETE CASCADE,
  uploaded_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_owner_check CHECK ((book_id IS NOT NULL)::integer + (artifact_id IS NOT NULL)::integer <= 1)
);

CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  institution TEXT NOT NULL,
  region TEXT NOT NULL,
  origin collection_origin NOT NULL,
  call_number TEXT,
  catalog_url TEXT,
  description TEXT,
  status review_status NOT NULL DEFAULT 'APPROVED',
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  artifact_id TEXT REFERENCES artifacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT holding_owner_check CHECK ((book_id IS NOT NULL)::integer + (artifact_id IS NOT NULL)::integer = 1)
);

CREATE TABLE IF NOT EXISTS research_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  publication TEXT,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  related_record_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status review_status NOT NULL DEFAULT 'APPROVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL CHECK (format IN ('holdings', 'overseas')),
  submitted_by workflow_lane NOT NULL,
  status review_status NOT NULL DEFAULT 'PENDING',
  total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
  valid_rows INTEGER NOT NULL CHECK (valid_rows >= 0 AND valid_rows <= total_rows),
  source_csv TEXT NOT NULL,
  reviewer_lane workflow_lane,
  review_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_batch_cross_review_check CHECK (reviewer_lane IS NULL OR reviewer_lane <> submitted_by)
);

CREATE TABLE IF NOT EXISTS import_batch_events (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'RESUBMITTED')),
  lane workflow_lane,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('BOOK', 'ARTIFACT', 'MEDIA_ASSET')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE books ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS books_title_idx ON books USING gin (to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS artifacts_title_idx ON artifacts USING gin (to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS media_assets_book_idx ON media_assets(book_id);
CREATE INDEX IF NOT EXISTS media_assets_artifact_idx ON media_assets(artifact_id);
CREATE INDEX IF NOT EXISTS holdings_institution_idx ON holdings(institution);
CREATE INDEX IF NOT EXISTS holdings_origin_region_idx ON holdings(origin, region);
CREATE INDEX IF NOT EXISTS research_articles_category_idx ON research_articles(category);
CREATE INDEX IF NOT EXISTS import_batches_status_created_idx ON import_batches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS import_batches_submitter_created_idx ON import_batches(submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS import_batch_events_batch_created_idx ON import_batch_events(batch_id, created_at ASC);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events(actor_id, created_at DESC);

CREATE OR REPLACE VIEW catalog_entries AS
SELECT
  books.id,
  'BOOK'::TEXT AS record_type,
  books.title,
  books.description,
  books.source,
  books.dynasty AS era,
  books.status::TEXT AS status,
  media_assets.storage_key,
  media_assets.visibility::TEXT AS visibility
FROM books
LEFT JOIN media_assets ON media_assets.book_id = books.id
UNION ALL
SELECT
  artifacts.id,
  'ARTIFACT'::TEXT AS record_type,
  artifacts.title,
  artifacts.description,
  artifacts.source,
  artifacts.era,
  artifacts.status::TEXT AS status,
  media_assets.storage_key,
  media_assets.visibility::TEXT AS visibility
FROM artifacts
LEFT JOIN media_assets ON media_assets.artifact_id = artifacts.id;

CREATE OR REPLACE VIEW review_queue AS
SELECT id, 'BOOK'::TEXT AS record_type, title, status::TEXT AS status, updated_at
FROM books
WHERE status IN ('DRAFT', 'PENDING', 'NEEDS_REVISION')
UNION ALL
SELECT id, 'ARTIFACT'::TEXT AS record_type, title, status::TEXT AS status, updated_at
FROM artifacts
WHERE status IN ('DRAFT', 'PENDING', 'NEEDS_REVISION');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS books_set_updated_at ON books;
CREATE TRIGGER books_set_updated_at
BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS artifacts_set_updated_at ON artifacts;
CREATE TRIGGER artifacts_set_updated_at
BEFORE UPDATE ON artifacts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS holdings_set_updated_at ON holdings;
CREATE TRIGGER holdings_set_updated_at
BEFORE UPDATE ON holdings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS research_articles_set_updated_at ON research_articles;
CREATE TRIGGER research_articles_set_updated_at
BEFORE UPDATE ON research_articles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS site_settings_set_updated_at ON site_settings;
CREATE TRIGGER site_settings_set_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS import_batches_set_updated_at ON import_batches;
CREATE TRIGGER import_batches_set_updated_at
BEFORE UPDATE ON import_batches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION audit_review_status_change()
RETURNS TRIGGER AS $$
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

DROP TRIGGER IF EXISTS books_review_status_audit ON books;
CREATE TRIGGER books_review_status_audit
AFTER UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION audit_review_status_change('BOOK');

DROP TRIGGER IF EXISTS artifacts_review_status_audit ON artifacts;
CREATE TRIGGER artifacts_review_status_audit
AFTER UPDATE ON artifacts
FOR EACH ROW EXECUTE FUNCTION audit_review_status_change('ARTIFACT');

CREATE OR REPLACE FUNCTION search_catalog(search_text TEXT DEFAULT NULL, requested_type TEXT DEFAULT NULL)
RETURNS TABLE (
  id TEXT,
  record_type TEXT,
  title TEXT,
  description TEXT,
  source TEXT,
  era TEXT,
  status TEXT,
  storage_key TEXT,
  visibility TEXT
) AS $$
  SELECT entries.id, entries.record_type, entries.title, entries.description, entries.source, entries.era, entries.status, entries.storage_key, entries.visibility
  FROM catalog_entries AS entries
  WHERE (requested_type IS NULL OR entries.record_type = requested_type)
    AND (
      search_text IS NULL
      OR search_text = ''
      OR concat_ws(' ', entries.title, entries.description, entries.source, entries.era) ILIKE '%' || search_text || '%'
    )
  ORDER BY entries.title;
$$ LANGUAGE SQL STABLE;
