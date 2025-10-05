import { Command } from 'commander';
import { db } from '../../src/db';
import { users, tenants } from '../../src/db/schema';
import { eq, sql } from 'drizzle-orm';

export const tenantCommands = new Command('tenant')
  .description('Tenant management commands');

// Create tenant
tenantCommands
  .command('create')
  .description('Create a new tenant')
  .requiredOption('-i, --id <id>', 'Tenant ID (unique identifier)')
  .requiredOption('-n, --name <name>', 'Tenant display name')
  .option('-d, --domain <domain>', 'Tenant domain')
  .option('--inactive', 'Create tenant as inactive')
  .action(async (options: { id: string; name: string; domain?: string; inactive?: boolean }) => {
    try {
      // Check if tenant already exists
      const existingTenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, options.id))
        .limit(1);

      if (existingTenant.length > 0) {
        console.error(`❌ Tenant with ID "${options.id}" already exists`);
        process.exit(1);
      }

      // Create tenant
      const [newTenant] = await db.insert(tenants).values({
        id: options.id,
        name: options.name,
        domain: options.domain || null,
        isActive: !options.inactive,
        settings: {},
      }).returning({
        id: tenants.id,
        name: tenants.name,
        domain: tenants.domain,
        isActive: tenants.isActive,
        createdAt: tenants.createdAt,
      });

      console.log('✅ Tenant created successfully:');
      console.log(`   ID: ${newTenant.id}`);
      console.log(`   Name: ${newTenant.name}`);
      console.log(`   Domain: ${newTenant.domain || 'None'}`);
      console.log(`   Status: ${newTenant.isActive ? 'Active' : 'Inactive'}`);
      console.log(`   Created: ${newTenant.createdAt.toLocaleDateString()}`);
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to create tenant:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List tenants
tenantCommands
  .command('list')
  .description('List all tenants')
  .option('-a, --all', 'Include inactive tenants')
  .action(async (options: { all?: boolean }) => {
    try {
      // Build query conditions
      let whereCondition;
      if (!options.all) {
        whereCondition = eq(tenants.isActive, true);
      }

      const allTenants = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          domain: tenants.domain,
          isActive: tenants.isActive,
          createdAt: tenants.createdAt,
          userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE tenant_id = tenants.id)::int`,
        })
        .from(tenants)
        .where(whereCondition)
        .orderBy(tenants.name);

      if (allTenants.length === 0) {
        console.log('No tenants found.');
        return;
      }

      console.log(`\n📋 Found ${allTenants.length} tenant(s):\n`);
      allTenants.forEach(tenant => {
        const status = tenant.isActive ? '🟢 Active' : '🔴 Inactive';
        console.log(`🏢 ${tenant.name} (${tenant.id}) ${status}`);
        console.log(`   Users: ${tenant.userCount}`);
        if (tenant.domain) {
          console.log(`   Domain: ${tenant.domain}`);
        }
        console.log(`   Created: ${tenant.createdAt.toLocaleDateString()}`);
        console.log();
      });
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to list tenants:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Show tenant details
tenantCommands
  .command('show')
  .description('Show details for a specific tenant')
  .argument('<tenant-id>', 'Tenant ID to show')
  .action(async (tenantId: string) => {
    try {
      const tenantUsers = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.tenantId, tenantId))
        .orderBy(users.createdAt);

      if (tenantUsers.length === 0) {
        console.log(`❌ No users found for tenant: ${tenantId}`);
        return;
      }

      console.log(`\n🏢 Tenant: ${tenantId}`);
      console.log(`👥 Users (${tenantUsers.length}):\n`);
      
      tenantUsers.forEach(user => {
        console.log(`   📧 ${user.email} (${user.role})`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Created: ${user.createdAt.toLocaleDateString()}`);
        console.log();
      });
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to show tenant details:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });