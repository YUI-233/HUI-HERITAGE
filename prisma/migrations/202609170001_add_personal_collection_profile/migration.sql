-- CreateTable: personal_collection_profiles (个人收藏馆资料)
-- 对应 lib/personal-collection-profile.ts 使用的 PersonalCollectionProfile 模型
-- 约定与现有迁移保持一致：TIMESTAMPTZ、_key 命名唯一索引、ON DELETE CASCADE ON UPDATE CASCADE

CREATE TABLE "personal_collection_profiles" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT,
  "cover_media_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personal_collection_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_collection_profiles_owner_id_key" ON "personal_collection_profiles" ("owner_id");
CREATE UNIQUE INDEX "personal_collection_profiles_slug_key" ON "personal_collection_profiles" ("slug");
CREATE INDEX "personal_collection_profiles_slug_idx" ON "personal_collection_profiles" ("slug");

ALTER TABLE "personal_collection_profiles"
  ADD CONSTRAINT "personal_collection_profiles_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
