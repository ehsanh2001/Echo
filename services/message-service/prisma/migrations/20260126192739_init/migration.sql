-- CreateTable
CREATE TABLE "public"."messages" (
    "workspace_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "message_no" BIGINT NOT NULL,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "parent_message_id" UUID,
    "thread_root_id" UUID,
    "thread_depth" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "content_type" VARCHAR(10) NOT NULL DEFAULT 'text',
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edit_count" INTEGER NOT NULL DEFAULT 0,
    "delivery_status" VARCHAR(20) NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("workspace_id","channel_id","message_no")
);

-- CreateTable
CREATE TABLE "public"."channel_sequences" (
    "workspace_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "last_message_no" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_sequences_pkey" PRIMARY KEY ("workspace_id","channel_id")
);

-- CreateTable
CREATE TABLE "public"."message_reactions" (
    "workspace_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" VARCHAR(10) NOT NULL,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("workspace_id","message_id","user_id","emoji")
);

-- CreateTable
CREATE TABLE "public"."message_mentions" (
    "workspace_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "mentioned_user_id" UUID NOT NULL,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mention_type" VARCHAR(20) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("workspace_id","message_id","mentioned_user_id")
);

-- CreateTable
CREATE TABLE "public"."message_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "s3_bucket" VARCHAR(100) NOT NULL,
    "thumbnail_s3_key" VARCHAR(500),
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."channel_read_receipts" (
    "workspace_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_message_no" BIGINT NOT NULL,
    "last_read_message_id" UUID,
    "last_read_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_read_receipts_pkey" PRIMARY KEY ("workspace_id","channel_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."thread_metadata" (
    "workspace_id" UUID NOT NULL,
    "thread_root_id" UUID NOT NULL,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "participant_count" INTEGER NOT NULL DEFAULT 0,
    "last_reply_at" TIMESTAMP,
    "last_reply_by" UUID,
    "last_reply_message_no" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_metadata_pkey" PRIMARY KEY ("workspace_id","thread_root_id")
);

-- CreateTable
CREATE TABLE "public"."archived_messages_index" (
    "workspace_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "message_no" BIGINT NOT NULL,
    "id" UUID NOT NULL,
    "s3_bucket" VARCHAR(100) NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "user_id" UUID NOT NULL,
    "content_preview" TEXT,
    "created_at" TIMESTAMP NOT NULL,
    "archived_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archive_batch_id" UUID,

    CONSTRAINT "archived_messages_index_pkey" PRIMARY KEY ("workspace_id","channel_id","message_no")
);

-- CreateIndex
CREATE INDEX "idx_messages_channel_msgno" ON "public"."messages"("workspace_id", "channel_id", "message_no" DESC);

-- CreateIndex
CREATE INDEX "idx_messages_user" ON "public"."messages"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_messages_thread_root" ON "public"."messages"("workspace_id", "thread_root_id");

-- CreateIndex
CREATE INDEX "idx_messages_created" ON "public"."messages"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "messages_id_key" ON "public"."messages"("id");

-- CreateIndex
CREATE INDEX "idx_reactions_message" ON "public"."message_reactions"("workspace_id", "message_id");

-- CreateIndex
CREATE INDEX "idx_reactions_user" ON "public"."message_reactions"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_mentions_user_unread" ON "public"."message_mentions"("workspace_id", "mentioned_user_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_mentions_message" ON "public"."message_mentions"("workspace_id", "message_id");

-- CreateIndex
CREATE INDEX "idx_attachments_message" ON "public"."message_attachments"("workspace_id", "message_id");

-- CreateIndex
CREATE INDEX "idx_attachments_user" ON "public"."message_attachments"("workspace_id", "uploaded_by");

-- CreateIndex
CREATE INDEX "idx_read_receipts_user" ON "public"."channel_read_receipts"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_read_receipts_channel" ON "public"."channel_read_receipts"("workspace_id", "channel_id");

-- CreateIndex
CREATE INDEX "idx_thread_metadata_last_reply" ON "public"."thread_metadata"("workspace_id", "last_reply_at" DESC);

-- CreateIndex
CREATE INDEX "idx_thread_metadata_root" ON "public"."thread_metadata"("thread_root_id");

-- CreateIndex
CREATE INDEX "idx_archived_messages_id" ON "public"."archived_messages_index"("id");

-- CreateIndex
CREATE INDEX "idx_archived_messages_workspace" ON "public"."archived_messages_index"("workspace_id", "archived_at" DESC);

-- CreateIndex
CREATE INDEX "idx_archived_messages_channel" ON "public"."archived_messages_index"("workspace_id", "channel_id", "message_no" DESC);

-- AddForeignKey
ALTER TABLE "public"."message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_mentions" ADD CONSTRAINT "message_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
