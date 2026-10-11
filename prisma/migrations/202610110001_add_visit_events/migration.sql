CREATE TABLE "visit_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "visitor_key" TEXT NOT NULL,
  "session_key" TEXT NOT NULL,
  "user_type" TEXT NOT NULL CHECK ("user_type" IN ('REGISTERED', 'GUEST')),
  "path" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content_type" TEXT NOT NULL DEFAULT 'PAGE' CHECK ("content_type" IN ('PAGE', 'BOOK', 'ARTICLE')),
  "content_id" TEXT,
  "source" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "visit_events_created_at_user_type_idx" ON "visit_events"("created_at", "user_type");
CREATE INDEX "visit_events_content_type_content_id_created_at_idx" ON "visit_events"("content_type", "content_id", "created_at");
