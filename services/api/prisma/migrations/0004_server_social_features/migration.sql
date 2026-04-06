-- Add welcomeScreen JSON field to Guild
ALTER TABLE "Guild" ADD COLUMN IF NOT EXISTS "welcomeScreen" JSONB;

-- Add selfAssignable flag to Role
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "selfAssignable" BOOLEAN NOT NULL DEFAULT false;

-- Add customStatusExpiresAt to PresenceState
ALTER TABLE "PresenceState" ADD COLUMN IF NOT EXISTS "customStatusExpiresAt" TIMESTAMP(3);

-- Add settings JSON field to User (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'settings'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Create UserNote table
CREATE TABLE IF NOT EXISTS "UserNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNote_pkey" PRIMARY KEY ("id")
);

-- Create unique index on UserNote
CREATE UNIQUE INDEX IF NOT EXISTS "UserNote_userId_targetId_key" ON "UserNote"("userId", "targetId");

-- Create index on UserNote userId
CREATE INDEX IF NOT EXISTS "UserNote_userId_idx" ON "UserNote"("userId");

-- Create ScheduledEvent table (if not exists)
CREATE TABLE IF NOT EXISTS "ScheduledEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" VARCHAR(1000),
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "interestedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledEvent_pkey" PRIMARY KEY ("id")
);

-- Create indexes for ScheduledEvent
CREATE INDEX IF NOT EXISTS "ScheduledEvent_guildId_idx" ON "ScheduledEvent"("guildId");

-- Add foreign key for ScheduledEvent -> Guild
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ScheduledEvent_guildId_fkey'
  ) THEN
    ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_guildId_fkey"
      FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
