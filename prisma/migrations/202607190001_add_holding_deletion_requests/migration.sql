ALTER TABLE "holding_revisions"
  ADD COLUMN "action" TEXT NOT NULL DEFAULT 'UPDATE',
  ADD COLUMN "request_reason" TEXT;

CREATE INDEX "holding_revisions_action_status_idx" ON "holding_revisions"("action", "status");
