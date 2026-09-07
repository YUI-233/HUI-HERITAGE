ALTER TABLE "personal_collection_items"
  ADD COLUMN "status" "review_status" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewed_by_user_id" TEXT,
  ADD COLUMN "review_comment" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ;

ALTER TABLE "personal_collection_items"
  ADD CONSTRAINT "personal_collection_items_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "personal_collection_items_status_created_at_idx"
  ON "personal_collection_items"("status", "created_at");
