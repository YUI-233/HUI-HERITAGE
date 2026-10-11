CREATE TABLE "personal_collection_profiles" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT,
  "public_collector_name" TEXT,
  "themes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "primary_eras" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "primary_region" TEXT,
  "collecting_since_year" INTEGER,
  "origin_story" TEXT,
  "collaboration_interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "accepts_messages" BOOLEAN,
  "cover_media_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "personal_collection_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_collection_profiles_owner_id_key"
  ON "personal_collection_profiles"("owner_id");
CREATE UNIQUE INDEX "personal_collection_profiles_slug_key"
  ON "personal_collection_profiles"("slug");
CREATE UNIQUE INDEX "personal_collection_profiles_cover_media_id_key"
  ON "personal_collection_profiles"("cover_media_id");

ALTER TABLE "personal_collection_profiles"
  ADD CONSTRAINT "personal_collection_profiles_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_collection_profiles"
  ADD CONSTRAINT "personal_collection_profiles_cover_media_id_fkey"
  FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
