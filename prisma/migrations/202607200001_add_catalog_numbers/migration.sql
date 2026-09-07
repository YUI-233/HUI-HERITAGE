ALTER TABLE books ADD COLUMN IF NOT EXISTS catalog_number TEXT;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS catalog_number TEXT;

UPDATE books
SET catalog_number = 'HH-M-' || UPPER(id)
WHERE catalog_number IS NULL;

UPDATE artifacts
SET catalog_number = 'HH-A-' || UPPER(id)
WHERE catalog_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS books_catalog_number_key ON books(catalog_number);
CREATE UNIQUE INDEX IF NOT EXISTS artifacts_catalog_number_key ON artifacts(catalog_number);

CREATE OR REPLACE FUNCTION assign_catalog_system_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.catalog_number IS NULL THEN
    NEW.catalog_number := CASE TG_TABLE_NAME
      WHEN 'books' THEN 'HH-M-'
      ELSE 'HH-A-'
    END || UPPER(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS books_assign_catalog_system_number ON books;
CREATE TRIGGER books_assign_catalog_system_number
BEFORE INSERT ON books
FOR EACH ROW EXECUTE FUNCTION assign_catalog_system_number();

DROP TRIGGER IF EXISTS artifacts_assign_catalog_system_number ON artifacts;
CREATE TRIGGER artifacts_assign_catalog_system_number
BEFORE INSERT ON artifacts
FOR EACH ROW EXECUTE FUNCTION assign_catalog_system_number();
