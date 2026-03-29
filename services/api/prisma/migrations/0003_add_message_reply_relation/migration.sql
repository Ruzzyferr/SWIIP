-- AlterTable: Add self-referencing foreign key for message replies
-- The column "referencedMessageId" already exists; this only adds the FK constraint.
ALTER TABLE "Message" ADD CONSTRAINT "Message_referencedMessageId_fkey"
  FOREIGN KEY ("referencedMessageId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
