CREATE TABLE "site_settings" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

CREATE TRIGGER "site_settings_set_updated_at" BEFORE UPDATE ON "site_settings"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
