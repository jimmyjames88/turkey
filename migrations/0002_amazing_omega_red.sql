CREATE TABLE IF NOT EXISTS "tenants" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"settings" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_name_idx" ON "tenants" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_domain_idx" ON "tenants" ("domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_active_idx" ON "tenants" ("is_active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
