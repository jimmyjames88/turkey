-- Add app_id column to revoked_jti table
ALTER TABLE "revoked_jti" ADD COLUMN "app_id" varchar(100) NOT NULL DEFAULT 'default-app';

-- Create index on app_id for performance
CREATE INDEX IF NOT EXISTS "revoked_jti_app_idx" ON "revoked_jti" ("app_id");

-- Remove the default value after migration (so new inserts must specify app_id)
-- This is commented out - run it manually after verifying existing data
-- ALTER TABLE "revoked_jti" ALTER COLUMN "app_id" DROP DEFAULT;
