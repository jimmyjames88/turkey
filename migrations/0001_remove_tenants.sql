-- Migration: Remove multi-tenancy support
-- This migration removes tenant-related tables and columns

-- Drop foreign key constraints first
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenant_id_tenants_id_fk";
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_tenant_id_tenants_id_fk";

-- Drop indexes related to tenants
DROP INDEX IF EXISTS "users_tenant_idx";
DROP INDEX IF EXISTS "refresh_tokens_tenant_idx";
DROP INDEX IF EXISTS "tenants_name_idx";
DROP INDEX IF EXISTS "tenants_domain_idx";
DROP INDEX IF EXISTS "tenants_active_idx";

-- Remove tenant_id columns
ALTER TABLE "users" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "tenant_id";

-- Drop unique constraint on users that included tenant_id
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_tenant_unique";

-- Add new unique constraint on email only (globally unique)
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");

-- Drop tenants table completely
DROP TABLE IF EXISTS "tenants";
