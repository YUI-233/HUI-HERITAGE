CREATE TABLE "user_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups"("name");

ALTER TABLE "users" ADD COLUMN "display_name" TEXT;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "review_lane" "workflow_lane";
ALTER TABLE "users" ADD COLUMN "group_id" TEXT;

ALTER TABLE "users"
  ADD CONSTRAINT "users_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "user_groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_group_id_idx" ON "users"("group_id");
CREATE INDEX "users_review_lane_idx" ON "users"("review_lane");
