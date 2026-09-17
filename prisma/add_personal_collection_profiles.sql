-- 手动迁移参考：新增 personal_collection_profiles 表
-- 优先在本地用 `npx prisma migrate dev --name add_personal_collection_profile` 生成并应用；
-- 若因迁移历史不完整导致 migrate deploy 失败，可直接用本文件对数据库执行。
-- 目标库：PostgreSQL（与现有 personal_collection_items / users / media_assets 同库）

CREATE TABLE "personal_collection_profiles" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT,
  "cover_media_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personal_collection_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_collection_profiles_owner_id_key" ON "personal_collection_profiles" ("owner_id");
CREATE UNIQUE INDEX "personal_collection_profiles_slug_key" ON "personal_collection_profiles" ("slug");
CREATE INDEX "personal_collection_profiles_slug_idx" ON "personal_collection_profiles" ("slug");

ALTER TABLE "personal_collection_profiles"
  ADD CONSTRAINT "personal_collection_profiles_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
