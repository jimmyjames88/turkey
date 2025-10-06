import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  index,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Tenants table
export const tenants = pgTable(
  'tenants',
  {
    id: varchar('id', { length: 50 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    settings: jsonb('settings').default('{}'),
  },
  table => ({
    nameIdx: index('tenants_name_idx').on(table.name),
    domainIdx: index('tenants_domain_idx').on(table.domain),
    activeIdx: index('tenants_active_idx').on(table.isActive),
  })
)

// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 50 }).notNull().default('user'),
    tenantId: varchar('tenant_id', { length: 50 })
      .notNull()
      .references(() => tenants.id),
    tokenVersion: integer('token_version').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => ({
    emailIdx: index('users_email_idx').on(table.email),
    tenantIdx: index('users_tenant_idx').on(table.tenantId),
    emailTenantUnique: unique('users_email_tenant_unique').on(table.email, table.tenantId),
  })
)

// Refresh tokens table
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 50 })
      .notNull()
      .references(() => tenants.id),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    replacedById: uuid('replaced_by_id'),
  },
  table => ({
    userIdx: index('refresh_tokens_user_idx').on(table.userId),
    tenantIdx: index('refresh_tokens_tenant_idx').on(table.tenantId),
    hashIdx: index('refresh_tokens_hash_idx').on(table.tokenHash),
  })
)

// Cryptographic keys table
export const keys = pgTable(
  'keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kid: varchar('kid', { length: 50 }).notNull().unique(),
    alg: varchar('alg', { length: 10 }).notNull().default('ES256'),
    publicPem: text('public_pem').notNull(),
    privatePem: text('private_pem').notNull(), // Should be encrypted in production
    createdAt: timestamp('created_at').notNull().defaultNow(),
    retiredAt: timestamp('retired_at'),
    isActive: boolean('is_active').notNull().default(true),
  },
  table => ({
    kidIdx: index('keys_kid_idx').on(table.kid),
    activeIdx: index('keys_active_idx').on(table.isActive),
  })
)

// Revoked JTI table (optional - for access token denylist)
export const revokedJti = pgTable(
  'revoked_jti',
  {
    jti: varchar('jti', { length: 100 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 100 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => ({
    userIdx: index('revoked_jti_user_idx').on(table.userId),
    expiresIdx: index('revoked_jti_expires_idx').on(table.expiresAt),
  })
)

// Audit log table
export const audit = pgTable(
  'audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    actor: varchar('actor', { length: 100 }), // system, admin, user
    action: varchar('action', { length: 50 }).notNull(), // login, logout, refresh, etc.
    ip: varchar('ip', { length: 45 }), // IPv6 compatible
    userAgent: text('user_agent'),
    meta: text('meta'), // JSON string for additional data
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => ({
    userIdx: index('audit_user_idx').on(table.userId),
    actionIdx: index('audit_action_idx').on(table.action),
    createdIdx: index('audit_created_idx').on(table.createdAt),
  })
)

// Relations
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [refreshTokens.tenantId],
    references: [tenants.id],
  }),
}))

export const revokedJtiRelations = relations(revokedJti, ({ one }) => ({
  user: one(users, {
    fields: [revokedJti.userId],
    references: [users.id],
  }),
}))

export const auditRelations = relations(audit, ({ one }) => ({
  user: one(users, {
    fields: [audit.userId],
    references: [users.id],
  }),
}))

// Tenant relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  refreshTokens: many(refreshTokens),
}))

// User relations (updated to include tenant)
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  refreshTokens: many(refreshTokens),
}))
