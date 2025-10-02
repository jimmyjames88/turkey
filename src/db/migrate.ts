import { config } from '../config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index';
import path from 'path';

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    console.log('Database URL:', config.databaseUrl.replace(/\/\/.*@/, '//***:***@')); // Log with hidden credentials
    
    await migrate(db, { 
      migrationsFolder: path.join(process.cwd(), 'migrations') 
    });
    
    console.log('✅ Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();