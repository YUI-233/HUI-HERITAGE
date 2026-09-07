ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_entity_type_check";

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_entity_type_check"
  CHECK ("entity_type" IN ('BOOK', 'ARTIFACT', 'MEDIA_ASSET', 'USER_PROFILE'));
