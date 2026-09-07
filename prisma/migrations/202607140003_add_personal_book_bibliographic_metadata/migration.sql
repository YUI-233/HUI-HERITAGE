ALTER TABLE "personal_collection_items"
  ADD COLUMN "era_detail" TEXT,
  ADD COLUMN "publication_date" TEXT,
  ADD COLUMN "imprint_publisher" TEXT,
  ADD COLUMN "binding" TEXT,
  ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
