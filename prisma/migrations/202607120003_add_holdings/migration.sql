CREATE TYPE "collection_origin" AS ENUM ('DOMESTIC', 'OVERSEAS', 'PERSONAL');

CREATE TABLE "holdings" (
  "id" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "origin" "collection_origin" NOT NULL,
  "call_number" TEXT,
  "catalog_url" TEXT,
  "description" TEXT,
  "status" "review_status" NOT NULL DEFAULT 'APPROVED',
  "book_id" TEXT,
  "artifact_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "holdings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "holding_owner_check" CHECK (("book_id" IS NOT NULL)::integer + ("artifact_id" IS NOT NULL)::integer = 1)
);

CREATE INDEX "holdings_institution_idx" ON "holdings"("institution");
CREATE INDEX "holdings_origin_region_idx" ON "holdings"("origin", "region");

ALTER TABLE "holdings" ADD CONSTRAINT "holdings_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER "holdings_set_updated_at" BEFORE UPDATE ON "holdings"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
