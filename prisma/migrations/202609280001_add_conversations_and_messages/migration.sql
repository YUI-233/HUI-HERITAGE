-- CreateTable: conversations（一对一站内信会话）
-- 参与者按字典序存储（participant_one_id < participant_two_id），保证两人之间仅一条会话。

CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "participant_one_id" TEXT NOT NULL,
    "participant_two_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: messages（站内信消息，read_at 为空表示接收方未读）

CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex

CREATE UNIQUE INDEX "conversations_participant_one_id_participant_two_id_key"
    ON "conversations"("participant_one_id", "participant_two_id");

CREATE INDEX "conversations_participant_one_id_last_message_at_idx"
    ON "conversations"("participant_one_id", "last_message_at");

CREATE INDEX "conversations_participant_two_id_last_message_at_idx"
    ON "conversations"("participant_two_id", "last_message_at");

CREATE INDEX "messages_conversation_id_created_at_idx"
    ON "messages"("conversation_id", "created_at");

CREATE INDEX "messages_conversation_id_sender_id_read_at_idx"
    ON "messages"("conversation_id", "sender_id", "read_at");

-- AddForeignKey

ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_participant_one_id_fkey"
    FOREIGN KEY ("participant_one_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_participant_two_id_fkey"
    FOREIGN KEY ("participant_two_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
