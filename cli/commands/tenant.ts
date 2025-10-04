import { Command } from 'commander';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { eq, sql } from 'drizzle-orm';

export const tenantCommands = new Command('tenant')
  .description('Tenant management commands');

// List tenants (based on existing users)
tenantCommands
  .command('list')
  .description('List all tenants (discovered from user records)')
  .action(async () => {
    try {
      const tenantCounts = await db
        .select({
          tenantId: users.tenantId,
          userCount: sql<number>`count(*)::int`,
        })
        .from(users)
        .groupBy(users.tenantId)
        .orderBy(users.tenantId);

      if (tenantCounts.length === 0) {
        console.log('No tenants found (no users exist yet).');
        return;
      }

      console.log(`\n📋 Found ${tenantCounts.length} tenant(s):\n`);
      tenantCounts.forEach(tenant => {
        console.log(`🏢 Tenant: ${tenant.tenantId}`);
        console.log(`   Users: ${tenant.userCount}`);
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