ALTER TABLE "research_articles" ADD COLUMN "published_year" TEXT;
ALTER TABLE "research_articles" ADD COLUMN "volume_issue" TEXT;
ALTER TABLE "research_articles" ADD COLUMN "pages" TEXT;
ALTER TABLE "research_articles" ADD COLUMN "identifier" TEXT;

ALTER TABLE "research_review_requests" ADD COLUMN "published_year" TEXT;
ALTER TABLE "research_review_requests" ADD COLUMN "volume_issue" TEXT;
ALTER TABLE "research_review_requests" ADD COLUMN "pages" TEXT;
ALTER TABLE "research_review_requests" ADD COLUMN "identifier" TEXT;
