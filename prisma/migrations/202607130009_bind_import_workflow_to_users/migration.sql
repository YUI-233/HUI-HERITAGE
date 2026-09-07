ALTER TABLE "import_batches" ADD COLUMN "submitted_by_user_id" TEXT;
ALTER TABLE "import_batches" ADD COLUMN "reviewed_by_user_id" TEXT;

ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_submitted_by_user_id_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "import_batches_submitted_by_user_id_idx" ON "import_batches"("submitted_by_user_id");
CREATE INDEX "import_batches_reviewed_by_user_id_idx" ON "import_batches"("reviewed_by_user_id");
