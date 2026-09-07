ALTER TABLE "media_assets"
  ADD COLUMN "personal_collection_item_id" TEXT;

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_personal_collection_item_id_fkey"
  FOREIGN KEY ("personal_collection_item_id")
  REFERENCES "personal_collection_items"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE INDEX "media_assets_personal_collection_item_id_idx"
  ON "media_assets"("personal_collection_item_id");
