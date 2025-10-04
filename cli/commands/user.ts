import { Command } from 'commander';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import * as readline from 'readline';

// Helper function to prompt for confirmation
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const response = answer.toLowerCase().trim();
      resolve(response === 'y' || response === 'yes');
    });
  });
}

export const userCommands = new Command('user')
  .description('User management commands');

// Create user
userCommands
  .command('create')
  .description('Create a new user')
  .requiredOption('-e, --email <email>', 'User email address')
  .requiredOption('-p, --password <password>', 'User password')
  .option('-t, --tenant <tenant-id>', 'Tenant ID', 'default')
  .option('-r, --role <role>', 'User role', 'user')
  .action(async (options: { email: string; password: string; tenant: string; role: string }) => {
    try {
      // Check if user already exists in this tenant
      const existingUser = await db
        .select()
        .from(users)
        .where(and(
          eq(users.email, options.email),
          eq(users.tenantId, options.tenant)
        ))
        .limit(1);

      if (existingUser.length > 0) {
        console.error(`❌ User with email ${options.email} already exists in tenant "${options.tenant}"`);
        process.exit(1);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(options.password, 12);

      // Create user
      const [newUser] = await db.insert(users).values({
        email: options.email,
        passwordHash,
        role: options.role,
        tenantId: options.tenant,
      }).returning({
        id: users.id,
        email: users.email,
        role: users.role,
        tenantId: users.tenantId,
        createdAt: users.createdAt,
      });

      console.log('✅ User created successfully:');
      console.log(`   ID: ${newUser.id}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Role: ${newUser.role}`);
      console.log(`   Tenant: ${newUser.tenantId}`);
      console.log(`   Created: ${newUser.createdAt.toLocaleDateString()}`);
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to create user:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List users
userCommands
  .command('list')
  .description('List users')
  .option('-t, --tenant <tenant-id>', 'Filter by tenant ID')
  .option('-r, --role <role>', 'Filter by role')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async (options: { tenant?: string; role?: string; limit: string }) => {
    try {
      // Build where conditions
      let whereCondition;
      if (options.tenant && options.role) {
        whereCondition = and(eq(users.tenantId, options.tenant), eq(users.role, options.role));
      } else if (options.tenant) {
        whereCondition = eq(users.tenantId, options.tenant);
      } else if (options.role) {
        whereCondition = eq(users.role, options.role);
      }

      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        role: users.role,
        tenantId: users.tenantId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereCondition)
      .limit(parseInt(options.limit))
      .orderBy(users.createdAt);

      if (allUsers.length === 0) {
        console.log('No users found.');
        return;
      }

      console.log(`\n👥 Found ${allUsers.length} user(s):\n`);
      allUsers.forEach(user => {
        console.log(`📧 ${user.email} (${user.role})`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Tenant: ${user.tenantId}`);
        console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
        console.log();
      });

      if (allUsers.length === parseInt(options.limit)) {
        console.log('🔍 Results may be truncated. Use --limit to see more.');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to list users:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Delete user
userCommands
  .command('delete')
  .description('Delete a user')
  .argument('<user-id>', 'User ID to delete')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (userId: string, options: { yes?: boolean }) => {
    try {
      // Get user details first
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.error(`❌ User with ID ${userId} not found`);
        process.exit(1);
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to delete user: ${user.email} (${user.id})`);
        console.log('   This action cannot be undone.');
        
        const confirmed = await askConfirmation('\nAre you sure you want to proceed? (y/N): ');
        
        if (!confirmed) {
          console.log('❌ Operation cancelled.');
          process.exit(0);
        }
      }

      // Delete user
      await db.delete(users).where(eq(users.id, userId));

      console.log('✅ User deleted successfully:');
      console.log(`   Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to delete user:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Find user by email
userCommands
  .command('find')
  .description('Find users by email address (supports partial matching)')
  .argument('<email>', 'Email address or partial email to search for')
  .option('-t, --tenant <tenant-id>', 'Filter by tenant ID')
  .option('-r, --role <role>', 'Filter by role')
  .option('-e, --exact', 'Exact email match only (no partial matching)')
  .action(async (emailQuery: string, options: { tenant?: string; role?: string; exact?: boolean }) => {
    try {
      // Build where conditions
      let whereConditions = [];
      
      // Email condition - exact or partial match
      if (options.exact) {
        whereConditions.push(eq(users.email, emailQuery));
      } else {
        whereConditions.push(sql`${users.email} ILIKE ${`%${emailQuery}%`}`);
      }
      
      // Add tenant filter if specified
      if (options.tenant) {
        whereConditions.push(eq(users.tenantId, options.tenant));
      }
      
      // Add role filter if specified
      if (options.role) {
        whereConditions.push(eq(users.role, options.role));
      }
      
      // Combine all conditions
      const whereCondition = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

      const foundUsers = await db.select({
        id: users.id,
        email: users.email,
        role: users.role,
        tenantId: users.tenantId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereCondition)
      .orderBy(users.email);

      if (foundUsers.length === 0) {
        const searchType = options.exact ? 'exact' : 'partial';
        console.log(`🔍 No users found with ${searchType} email match: "${emailQuery}"`);
        if (options.tenant) {
          console.log(`   in tenant: ${options.tenant}`);
        }
        if (options.role) {
          console.log(`   with role: ${options.role}`);
        }
        process.exit(0);
      }

      const searchType = options.exact ? 'exact' : 'partial';
      console.log(`\n🎯 Found ${foundUsers.length} user(s) with ${searchType} email match: "${emailQuery}"\n`);
      
      foundUsers.forEach(user => {
        console.log(`📧 ${user.email} (${user.role})`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Tenant: ${user.tenantId}`);
        console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
        console.log();
      });
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to find users:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });