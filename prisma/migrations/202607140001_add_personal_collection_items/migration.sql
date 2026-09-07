CREATE TYPE "personal_item_type" AS ENUM ('BOOK', 'ARTIFACT');

CREATE TABLE "personal_collection_items" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "type" "personal_item_type" NOT NULL,
  "title" TEXT NOT NULL,
  "creator" TEXT,
  "era" TEXT,
  "edition_or_category" TEXT,
  "volume_count" INTEGER NOT NULL DEFAULT 1,
  "serial_number" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personal_collection_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_collection_items_owner_id_serial_number_key" ON "personal_collection_items"("owner_id", "serial_number");
CREATE INDEX "personal_collection_items_owner_id_type_created_at_idx" ON "personal_collection_items"("owner_id", "type", "created_at");

ALTER TABLE "personal_collection_items" ADD CONSTRAINT "personal_collection_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER "personal_collection_items_set_updated_at" BEFORE UPDATE ON "personal_collection_items"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
