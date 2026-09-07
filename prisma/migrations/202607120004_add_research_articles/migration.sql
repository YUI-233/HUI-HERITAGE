CREATE TABLE "research_articles" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "publication" TEXT,
  "summary" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "related_record_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "review_status" NOT NULL DEFAULT 'APPROVED',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_articles_category_idx" ON "research_articles"("category");

CREATE TRIGGER "research_articles_set_updated_at" BEFORE UPDATE ON "research_articles"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
