ALTER TABLE "books"
  ADD COLUMN "era_detail" TEXT,
  ADD COLUMN "publication_date" TEXT,
  ADD COLUMN "imprint_publisher" TEXT,
  ADD COLUMN "binding" TEXT,
  ADD COLUMN "volume_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "books_categories_idx" ON "books" USING GIN ("categories");
