ALTER TABLE "books" ADD COLUMN "submitted_by_user_id" TEXT;
ALTER TABLE "books" ADD COLUMN "submitted_by_lane" "workflow_lane";
ALTER TABLE "books" ADD COLUMN "reviewed_by_user_id" TEXT;
ALTER TABLE "books" ADD COLUMN "reviewer_lane" "workflow_lane";
ALTER TABLE "books" ADD COLUMN "review_comment" TEXT;
ALTER TABLE "books" ADD COLUMN "reviewed_at" TIMESTAMP(3);

ALTER TABLE "artifacts" ADD COLUMN "submitted_by_user_id" TEXT;
ALTER TABLE "artifacts" ADD COLUMN "submitted_by_lane" "workflow_lane";
ALTER TABLE "artifacts" ADD COLUMN "reviewed_by_user_id" TEXT;
ALTER TABLE "artifacts" ADD COLUMN "reviewer_lane" "workflow_lane";
ALTER TABLE "artifacts" ADD COLUMN "review_comment" TEXT;
ALTER TABLE "artifacts" ADD COLUMN "reviewed_at" TIMESTAMP(3);

ALTER TABLE "books" ADD CONSTRAINT "books_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "books" ADD CONSTRAINT "books_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "books_status_submitted_by_lane_idx" ON "books"("status", "submitted_by_lane");
CREATE INDEX "artifacts_status_submitted_by_lane_idx" ON "artifacts"("status", "submitted_by_lane");
