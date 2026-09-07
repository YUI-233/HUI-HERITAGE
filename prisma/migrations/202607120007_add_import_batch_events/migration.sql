CREATE TABLE "import_batch_events" (
  "id" BIGSERIAL NOT NULL,
  "batch_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "lane" "workflow_lane",
  "comment" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_batch_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "import_batch_event_action_check" CHECK ("action" IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'RESUBMITTED'))
);

CREATE INDEX "import_batch_events_batch_created_idx" ON "import_batch_events"("batch_id", "created_at" ASC);
ALTER TABLE "import_batch_events" ADD CONSTRAINT "import_batch_events_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
