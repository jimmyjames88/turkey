-- Add emailVerified column to users table
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;

-- Create email_tokens table
CREATE TABLE IF NOT EXISTS "email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes for email_tokens
CREATE INDEX IF NOT EXISTS "email_tokens_user_idx" ON "email_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "email_tokens_hash_idx" ON "email_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "email_tokens_type_idx" ON "email_tokens" ("type");
CREATE INDEX IF NOT EXISTS "email_tokens_expires_idx" ON "email_tokens" ("expires_at");
