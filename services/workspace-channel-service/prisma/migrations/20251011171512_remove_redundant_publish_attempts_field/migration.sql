/*
  Warnings:

  - You are about to drop the column `publish_attempts` on the `outbox_events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."outbox_events" DROP COLUMN "publish_attempts";
