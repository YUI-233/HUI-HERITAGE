CREATE SEQUENCE IF NOT EXISTS catalog_system_number_seq;

CREATE OR REPLACE FUNCTION next_catalog_system_suffix()
RETURNS TEXT AS $$
DECLARE
  value BIGINT := nextval('catalog_system_number_seq');
  alphabet TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  suffix TEXT := '';
BEGIN
  LOOP
    suffix := substr(alphabet, (value % 36)::INTEGER + 1, 1) || suffix;
    value := value / 36;
    EXIT WHEN value = 0;
  END LOOP;

  IF length(suffix) > 6 THEN
    RAISE EXCEPTION 'Catalogue system number range is exhausted';
  END IF;

  RETURN lpad(suffix, 6, '0');
END;
$$ LANGUAGE plpgsql;

UPDATE books
SET catalog_number = 'HH-M-' || next_catalog_system_suffix();

UPDATE artifacts
SET catalog_number = 'HH-A-' || next_catalog_system_suffix();

CREATE OR REPLACE FUNCTION assign_catalog_system_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.catalog_number IS NULL THEN
    NEW.catalog_number := CASE TG_TABLE_NAME
      WHEN 'books' THEN 'HH-M-'
      ELSE 'HH-A-'
    END || next_catalog_system_suffix();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
