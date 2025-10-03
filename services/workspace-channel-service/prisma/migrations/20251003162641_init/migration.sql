-- CreateEnum
CREATE TYPE "public"."WorkspaceRole" AS ENUM ('owner', 'admin', 'member', 'guest');

-- CreateEnum
CREATE TYPE "public"."ChannelRole" AS ENUM ('owner', 'admin', 'member', 'viewer');

-- CreateEnum
CREATE TYPE "public"."ChannelType" AS ENUM ('public', 'private', 'direct', 'group_dm');

-- CreateEnum
CREATE TYPE "public"."InviteType" AS ENUM ('workspace', 'channel');

-- CreateEnum
CREATE TYPE "public"."OutboxStatus" AS ENUM ('pending', 'published', 'failed');

-- CreateTable
CREATE TABLE "public"."workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "max_members" INTEGER,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "vanity_url" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workspace_members" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "public"."WorkspaceRole" NOT NULL DEFAULT 'member',
    "invited_by" UUID,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "preferences" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."channels" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "description" TEXT,
    "type" "public"."ChannelType" NOT NULL DEFAULT 'public',
    "created_by" UUID,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_read_only" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."channel_members" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_by" UUID,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "public"."ChannelRole" NOT NULL DEFAULT 'member',
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invites" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "channel_id" UUID,
    "inviter_id" UUID,
    "email" TEXT,
    "invite_token" TEXT NOT NULL,
    "type" "public"."InviteType" NOT NULL DEFAULT 'workspace',
    "expires_at" TIMESTAMP(3),
    "accepted_by" UUID,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "channel_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "target" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."outbox_events" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "channel_id" UUID,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "produced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "publish_attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."OutboxStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_display_name_key" ON "public"."workspaces"("display_name");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_vanity_url_key" ON "public"."workspaces"("vanity_url");

-- CreateIndex
CREATE INDEX "workspaces_is_public_is_archived_idx" ON "public"."workspaces"("is_public", "is_archived");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_idx" ON "public"."workspace_members"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "public"."workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "public"."workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "channels_workspace_id_idx" ON "public"."channels"("workspace_id");

-- CreateIndex
CREATE INDEX "channels_workspace_id_type_idx" ON "public"."channels"("workspace_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "channels_workspace_id_name_key" ON "public"."channels"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "channel_members_channel_id_idx" ON "public"."channel_members"("channel_id");

-- CreateIndex
CREATE INDEX "channel_members_user_id_idx" ON "public"."channel_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_members_channel_id_user_id_key" ON "public"."channel_members"("channel_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invites_invite_token_key" ON "public"."invites"("invite_token");

-- CreateIndex
CREATE INDEX "invites_workspace_id_idx" ON "public"."invites"("workspace_id");

-- CreateIndex
CREATE INDEX "invites_email_idx" ON "public"."invites"("email");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "public"."audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_channel_id_created_at_idx" ON "public"."audit_logs"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_produced_at_idx" ON "public"."outbox_events"("status", "produced_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "public"."outbox_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "outbox_events_workspace_id_idx" ON "public"."outbox_events"("workspace_id");

-- CreateIndex
CREATE INDEX "outbox_events_channel_id_idx" ON "public"."outbox_events"("channel_id");

-- AddForeignKey
ALTER TABLE "public"."workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."channels" ADD CONSTRAINT "channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."channel_members" ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invites" ADD CONSTRAINT "invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invites" ADD CONSTRAINT "invites_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."outbox_events" ADD CONSTRAINT "outbox_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."outbox_events" ADD CONSTRAINT "outbox_events_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
