-- Latest domestic and overseas spreadsheets enter the same peer-review queue.
-- The initial constraint only allowed the legacy `holdings` and `overseas` formats.
ALTER TABLE "import_batches" DROP CONSTRAINT IF EXISTS "import_batches_format_check";
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_format_check"
  CHECK ("format" IN ('holdings', 'overseas', 'domestic', 'overseas_latest'));
