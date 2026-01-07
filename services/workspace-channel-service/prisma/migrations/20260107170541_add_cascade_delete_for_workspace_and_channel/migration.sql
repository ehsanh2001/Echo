-- DropForeignKey
ALTER TABLE "public"."channel_members" DROP CONSTRAINT "channel_members_channel_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."channels" DROP CONSTRAINT "channels_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."workspace_members" DROP CONSTRAINT "workspace_members_workspace_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."channels" ADD CONSTRAINT "channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."channel_members" ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
