-- CreateTable
CREATE TABLE "user_conversations" (
    "user_id" UUID NOT NULL,
    "buyer_last_read_at" TIMESTAMPTZ(6),
    "admin_last_read_at" TIMESTAMPTZ(6),
    "last_buyer_at" TIMESTAMPTZ(6),
    "last_admin_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_conversations_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "client_message_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user_notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_messages_user_id_created_at_id_idx" ON "user_messages"("user_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "user_messages_user_id_author_id_client_message_id_key" ON "user_messages"("user_id", "author_id", "client_message_id");

-- CreateIndex
CREATE INDEX "admin_user_notes_user_id_created_at_id_idx" ON "admin_user_notes"("user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "loyalty_grants_user_id_created_at_id_idx" ON "loyalty_grants"("user_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "user_conversations" ADD CONSTRAINT "user_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_conversations"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_notes" ADD CONSTRAINT "admin_user_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_notes" ADD CONSTRAINT "admin_user_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_grants" ADD CONSTRAINT "loyalty_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_grants" ADD CONSTRAINT "loyalty_grants_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep malformed writes out even outside the HTTP validation layer.
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_role_check" CHECK ("author_role" IN ('buyer', 'admin'));
ALTER TABLE "user_messages" ADD CONSTRAINT "user_messages_text_check" CHECK (char_length(btrim("text")) BETWEEN 1 AND 4000);
ALTER TABLE "admin_user_notes" ADD CONSTRAINT "admin_user_notes_text_check" CHECK (char_length(btrim("text")) BETWEEN 1 AND 4000);
ALTER TABLE "loyalty_grants" ADD CONSTRAINT "loyalty_grants_amount_check" CHECK ("amount" BETWEEN 1 AND 10000);
ALTER TABLE "loyalty_grants" ADD CONSTRAINT "loyalty_grants_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 1 AND 500);
