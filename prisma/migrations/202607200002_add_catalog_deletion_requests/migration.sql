CREATE TABLE "catalog_deletion_requests" (
  "id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "record_type" TEXT NOT NULL,
  "record_title" TEXT NOT NULL,
  "status" "review_status" NOT NULL DEFAULT 'PENDING',
  "request_reason" TEXT NOT NULL,
  "submitted_by_user_id" TEXT,
  "reviewed_by_user_id" TEXT,
  "review_comment" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "catalog_deletion_requests_record_id_record_type_status_idx" ON "catalog_deletion_requests"("record_id", "record_type", "status");
CREATE INDEX "catalog_deletion_requests_status_created_at_idx" ON "catalog_deletion_requests"("status", "created_at");
CREATE INDEX "catalog_deletion_requests_submitted_by_user_id_idx" ON "catalog_deletion_requests"("submitted_by_user_id");

ALTER TABLE "catalog_deletion_requests" ADD CONSTRAINT "catalog_deletion_requests_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "catalog_deletion_requests" ADD CONSTRAINT "catalog_deletion_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
