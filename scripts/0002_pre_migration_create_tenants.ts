#!/usr/bin/env ts-node

/**
 * Pre-migration script to create tenant records for existing tenant IDs
 * This must be run BEFORE the main migration to avoid foreign key constraint errors
 */

import { db } from '../src/db'
import { users, tenants } from '../src/db/schema'

async function createTenantsFromExistingData() {
  console.log('🔍 Finding existing tenant IDs from users table...')

  // Get all unique tenant IDs from existing users
  const existingTenantIds = await db.selectDistinct({ tenantId: users.tenantId }).from(users)

  console.log(`📋 Found ${existingTenantIds.length} unique tenant IDs`)

  // Create tenant records for each existing tenant ID
  for (const { tenantId } of existingTenantIds) {
    const tenantName =
      tenantId === 'default'
        ? 'Default Tenant'
        : tenantId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

    try {
      await db.insert(tenants).values({
        id: tenantId,
        name: tenantName,
        domain: null,
        isActive: true,
        settings: {},
      })
      console.log(`✅ Created tenant: ${tenantId} (${tenantName})`)
    } catch (error) {
      // Ignore if tenant already exists
      if (error instanceof Error && error.message.includes('duplicate key')) {
        console.log(`⚠️  Tenant already exists: ${tenantId}`)
      } else {
        throw error
      }
    }
  }

  console.log('✅ All tenant records created successfully!')
}

// Run the migration
createTenantsFromExistingData()
  .then(() => {
    console.log('🎉 Pre-migration completed successfully!')
    console.log('👉 You can now run: npm run db:migrate')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Pre-migration failed:', error)
    process.exit(1)
  })
