UPDATE "books" SET "categories" = array_replace("categories", '10、学术研究', '十、学术研究') WHERE "categories" @> ARRAY['10、学术研究'];
UPDATE "category_requests" SET "parent_category" = '十、学术研究' WHERE "parent_category" = '10、学术研究';
UPDATE "category_requests" SET "proposed_name" = '十、学术研究' WHERE "scope" = 'MANUSCRIPT' AND "proposed_name" = '10、学术研究';
UPDATE "managed_categories" SET "parent_name" = '十、学术研究' WHERE "scope" = 'MANUSCRIPT' AND "parent_name" = '10、学术研究';
UPDATE "managed_categories" SET "name" = '十、学术研究' WHERE "scope" = 'MANUSCRIPT' AND "name" = '10、学术研究' AND NOT EXISTS (SELECT 1 FROM "managed_categories" AS "current" WHERE "current"."scope" = 'MANUSCRIPT' AND "current"."name" = '十、学术研究');
DELETE FROM "managed_categories" AS "legacy" WHERE "legacy"."scope" = 'MANUSCRIPT' AND "legacy"."name" = '10、学术研究' AND EXISTS (SELECT 1 FROM "managed_categories" AS "current" WHERE "current"."scope" = 'MANUSCRIPT' AND "current"."name" = '十、学术研究');
