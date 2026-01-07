-- DropForeignKey
ALTER TABLE "public"."outbox_events" DROP CONSTRAINT "outbox_events_channel_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."outbox_events" DROP CONSTRAINT "outbox_events_workspace_id_fkey";
