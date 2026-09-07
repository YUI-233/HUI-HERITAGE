CREATE TYPE "workflow_lane" AS ENUM ('A', 'B');

CREATE TABLE "import_batches" (
  "id" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "submitted_by" "workflow_lane" NOT NULL,
  "status" "review_status" NOT NULL DEFAULT 'PENDING',
  "total_rows" INTEGER NOT NULL,
  "valid_rows" INTEGER NOT NULL,
  "source_csv" TEXT NOT NULL,
  "reviewer_lane" "workflow_lane",
  "review_comment" TEXT,
  "reviewed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "import_batch_cross_review_check" CHECK ("reviewer_lane" IS NULL OR "reviewer_lane" <> "submitted_by"),
  CONSTRAINT "import_batch_row_count_check" CHECK ("total_rows" >= 0 AND "valid_rows" >= 0 AND "valid_rows" <= "total_rows"),
  CONSTRAINT "import_batch_format_check" CHECK ("format" IN ('holdings', 'overseas'))
);

CREATE INDEX "import_batches_status_created_idx" ON "import_batches"("status", "created_at" DESC);
CREATE INDEX "import_batches_submitter_created_idx" ON "import_batches"("submitted_by", "created_at" DESC);
