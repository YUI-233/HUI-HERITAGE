ALTER TABLE "research_articles" ADD COLUMN "content_html" TEXT NOT NULL DEFAULT '';

CREATE TABLE "research_review_requests" (
  "id" TEXT NOT NULL,
  "article_id" TEXT,
  "action" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "publication" TEXT,
  "summary" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "related_record_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "content_html" TEXT NOT NULL DEFAULT '',
  "status" "review_status" NOT NULL DEFAULT 'DRAFT',
  "request_reason" TEXT,
  "submitted_by_user_id" TEXT,
  "reviewed_by_user_id" TEXT,
  "review_comment" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "research_review_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_review_requests_article_id_status_idx" ON "research_review_requests"("article_id", "status");
CREATE INDEX "research_review_requests_status_created_at_idx" ON "research_review_requests"("status", "created_at");
CREATE INDEX "research_review_requests_submitted_by_user_id_idx" ON "research_review_requests"("submitted_by_user_id");

ALTER TABLE "research_review_requests" ADD CONSTRAINT "research_review_requests_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "research_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_review_requests" ADD CONSTRAINT "research_review_requests_submitted_by_user_id_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "research_review_requests" ADD CONSTRAINT "research_review_requests_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
