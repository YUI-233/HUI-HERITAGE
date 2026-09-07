ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMP(3),
  ADD COLUMN "password_changed_at" TIMESTAMP(3);

-- Existing local accounts were created before email verification existed.
-- Preserve their current access rather than unexpectedly locking them out.
UPDATE "users"
SET "email_verified_at" = "created_at"
WHERE "email_verified_at" IS NULL AND "is_active" = true;

CREATE TABLE "email_action_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_action_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_action_tokens_token_hash_key" ON "email_action_tokens"("token_hash");
CREATE INDEX "email_action_tokens_user_id_purpose_created_at_idx" ON "email_action_tokens"("user_id", "purpose", "created_at");
CREATE INDEX "email_action_tokens_purpose_expires_at_idx" ON "email_action_tokens"("purpose", "expires_at");

ALTER TABLE "email_action_tokens"
  ADD CONSTRAINT "email_action_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
