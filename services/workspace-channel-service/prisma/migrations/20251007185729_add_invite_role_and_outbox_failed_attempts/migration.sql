-- AlterTable
ALTER TABLE "public"."invites" ADD COLUMN     "role" "public"."WorkspaceRole" NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE "public"."outbox_events" ADD COLUMN     "failed_attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "invites_invite_token_idx" ON "public"."invites"("invite_token");

-- CreateIndex
CREATE INDEX "invites_workspace_id_email_idx" ON "public"."invites"("workspace_id", "email");
