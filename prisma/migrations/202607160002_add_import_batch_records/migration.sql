CREATE TABLE "import_batch_records" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "row_index" INTEGER NOT NULL,
  "source_row" INTEGER NOT NULL,
  "values" JSONB NOT NULL,
  "status" "review_status" NOT NULL DEFAULT 'PENDING',
  "review_comment" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_batch_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "import_batch_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "import_batch_records_batch_id_row_index_key" ON "import_batch_records"("batch_id", "row_index");
CREATE INDEX "import_batch_records_batch_id_status_idx" ON "import_batch_records"("batch_id", "status");
