/*
  Warnings:

  - A unique constraint covering the columns `[token_id]` on the table `password_reset_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token_id` to the `password_reset_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."password_reset_tokens" ADD COLUMN     "token_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_id_key" ON "public"."password_reset_tokens"("token_id");
