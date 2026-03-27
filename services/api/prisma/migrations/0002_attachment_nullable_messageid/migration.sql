-- AlterTable: make messageId nullable for pending attachments
ALTER TABLE "Attachment" ALTER COLUMN "messageId" DROP NOT NULL;

-- Add channelId and uploaderId columns for pending attachment tracking
ALTER TABLE "Attachment" ADD COLUMN "channelId" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "uploaderId" TEXT;

-- Drop existing foreign key and re-create with nullable support
ALTER TABLE "Attachment" DROP CONSTRAINT IF EXISTS "Attachment_messageId_fkey";
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
