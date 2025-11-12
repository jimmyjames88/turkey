-- Add app_id column to users table
ALTER TABLE "users" ADD COLUMN "app_id" varchar(100) NOT NULL DEFAULT 'default-app';

-- Drop the old unique constraint on email only
DROP INDEX IF EXISTS "users_email_idx";

-- Create new composite unique index on (email, app_id)
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_app_idx" ON "users" ("email", "app_id");

-- Create index on app_id for queries filtering by app
CREATE INDEX IF NOT EXISTS "users_app_idx" ON "users" ("app_id");

-- Remove the default value after migration (so new inserts must specify app_id)
-- This is commented out - run it manually after verifying existing data
-- ALTER TABLE "users" ALTER COLUMN "app_id" DROP DEFAULT;
