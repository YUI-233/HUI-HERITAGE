ALTER TABLE "user_groups"
  ADD COLUMN "daily_borrow_limit_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "daily_borrow_limit" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "user_groups"
  ADD CONSTRAINT "user_groups_daily_borrow_limit_check"
  CHECK ("daily_borrow_limit" BETWEEN 1 AND 100);

CREATE TABLE "borrowing_cards" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "card_number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "borrowing_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "borrowing_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "book_id" TEXT NOT NULL,
  "borrowed_on" DATE NOT NULL,
  "borrowed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "borrowing_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "borrowing_cards_user_id_key" ON "borrowing_cards"("user_id");
CREATE UNIQUE INDEX "borrowing_cards_card_number_key" ON "borrowing_cards"("card_number");
CREATE UNIQUE INDEX "borrowing_records_user_id_book_id_borrowed_on_key" ON "borrowing_records"("user_id", "book_id", "borrowed_on");
CREATE INDEX "borrowing_records_user_id_borrowed_on_idx" ON "borrowing_records"("user_id", "borrowed_on");
CREATE INDEX "borrowing_records_book_id_borrowed_at_idx" ON "borrowing_records"("book_id", "borrowed_at");

ALTER TABLE "borrowing_cards"
  ADD CONSTRAINT "borrowing_cards_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borrowing_records"
  ADD CONSTRAINT "borrowing_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borrowing_records"
  ADD CONSTRAINT "borrowing_records_book_id_fkey"
  FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
