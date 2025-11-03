import { Command } from 'commander'
import * as readline from 'readline'

// Helper function to prompt for confirmation
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      const response = answer.toLowerCase().trim()
      resolve(response === 'y' || response === 'yes')
    })
  })
}

export const keyCommands = new Command('key').description('Cryptographic key management')

// Key status/list
keyCommands
  .command('status')
  .description('Show cryptographic key status')
  .option('-a, --all', 'Show all keys including retired')
  .option('-v, --verbose', 'Show detailed key information')
  .action(async (options: { all?: boolean; verbose?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { keys } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      // Get keys based on filter
      const keyList = options.all
        ? await db.select().from(keys).orderBy(keys.createdAt)
        : await db.select().from(keys).where(eq(keys.isActive, true)).orderBy(keys.createdAt)

      if (keyList.length === 0) {
        console.log('⚠️  No keys found. Run "gravy key generate" to create one.')
        process.exit(0)
      }

      console.log(`\n🔐 Cryptographic Keys (${keyList.length} total):\n`)

      keyList.forEach(key => {
        const status = key.isActive ? '✅ Active' : '❌ Retired'
        const age = Math.floor((Date.now() - key.createdAt.getTime()) / (1000 * 60 * 60 * 24))

        console.log(`${status} ${key.kid}`)
        console.log(`   Algorithm: ${key.alg}`)
        console.log(`   Created: ${key.createdAt.toLocaleString()} (${age} days ago)`)

        if (key.retiredAt) {
          const retiredAge = Math.floor(
            (Date.now() - key.retiredAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          console.log(`   Retired: ${key.retiredAt.toLocaleString()} (${retiredAge} days ago)`)
        }

        if (options.verbose) {
          console.log(`   Public Key (PEM):`)
          console.log(`   ${key.publicPem.split('\n')[1].substring(0, 40)}...`)
        }

        console.log()
      })

      // Show active key count
      const activeCount = keyList.filter(k => k.isActive).length
      console.log(`📊 Active keys: ${activeCount}`)

      if (activeCount === 0) {
        console.log('⚠️  WARNING: No active keys! Token signing will fail.')
        console.log('💡 Run "gravy key generate" to create a new active key.')
      } else if (activeCount > 1) {
        console.log('ℹ️  Note: Multiple active keys detected (key rotation in progress?)')
      }

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to get key status:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Generate new key
keyCommands
  .command('generate')
  .description('Generate a new ES256 key pair')
  .option('-a, --activate', 'Immediately activate this key for signing', false)
  .action(async (options: { activate?: boolean }) => {
    try {
      console.log('🔐 Generating new ES256 key pair...')

      const { generateES256KeyPair, storeKeyPair } = await import('../../src/services/keyService')

      const keyPair = await generateES256KeyPair()

      // Store the key (defaults to active=true in keyService)
      await storeKeyPair(keyPair)

      console.log('✅ Key pair generated and stored successfully')
      console.log(`   Key ID: ${keyPair.kid}`)
      console.log(`   Algorithm: ES256`)
      console.log(`   Status: ${options.activate ? 'Active' : 'Active'}`)

      console.log('\n📋 Next steps:')
      console.log('   • Verify with: gravy key status')
      console.log('   • If rotating keys, retire old ones: gravy key retire <kid>')

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to generate key:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Retire key
keyCommands
  .command('retire')
  .description('Retire a cryptographic key (mark as inactive)')
  .argument('<kid>', 'Key ID to retire')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (kid: string, options: { yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { keys } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      // Get key details
      const [key] = await db.select().from(keys).where(eq(keys.kid, kid)).limit(1)

      if (!key) {
        console.error(`❌ Key not found: ${kid}`)
        process.exit(1)
      }

      if (!key.isActive) {
        console.log(`ℹ️  Key already retired at: ${key.retiredAt?.toLocaleString()}`)
        process.exit(0)
      }

      // Check if this is the only active key
      const activeKeys = await db.select().from(keys).where(eq(keys.isActive, true))

      if (activeKeys.length === 1 && activeKeys[0].kid === kid) {
        console.error('❌ Cannot retire the only active key!')
        console.error('💡 Generate a new key first: gravy key generate')
        process.exit(1)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to retire key: ${kid}`)
        console.log(`   Created: ${key.createdAt.toLocaleString()}`)
        console.log(`   This key will no longer be used for signing new tokens.`)
        console.log(`   Existing tokens signed with this key will still be valid.`)

        const confirmed = await askConfirmation('\nAre you sure? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Retire the key
      const { retireKey } = await import('../../src/services/keyService')
      await retireKey(kid)

      console.log('✅ Key retired successfully')
      console.log(`   Key ID: ${kid}`)
      console.log(`   Status: Retired`)

      // Log to audit trail
      const { audit } = await import('../../src/db/schema')
      await db.insert(audit).values({
        actor: 'admin',
        action: 'key_retired',
        meta: JSON.stringify({ kid }),
      })

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to retire key:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Rotate keys (generate new + retire old)
keyCommands
  .command('rotate')
  .description('Generate new key and retire old active keys')
  .option('-k, --keep-old', 'Keep old keys active (graceful rotation)', false)
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options: { keepOld?: boolean; yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { keys } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      // Get current active keys
      const activeKeys = await db.select().from(keys).where(eq(keys.isActive, true))

      if (!options.yes) {
        console.log('🔄 Key Rotation Plan:')
        console.log(`   • Generate new ES256 key pair`)
        console.log(`   • Current active keys: ${activeKeys.length}`)

        if (options.keepOld) {
          console.log(`   • Keep old keys active (graceful rotation)`)
          console.log(`   • Manually retire old keys later`)
        } else {
          console.log(`   • Retire ${activeKeys.length} old key(s) immediately`)
        }

        const confirmed = await askConfirmation('\nProceed with key rotation? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      console.log('\n🔐 Generating new key pair...')

      const { generateES256KeyPair, storeKeyPair, retireKey } = await import(
        '../../src/services/keyService'
      )

      // Generate and store new key
      const newKey = await generateES256KeyPair()
      await storeKeyPair(newKey)

      console.log(`✅ New key generated: ${newKey.kid}`)

      // Retire old keys if not keeping them
      if (!options.keepOld) {
        console.log(`\n🗑️  Retiring ${activeKeys.length} old key(s)...`)

        for (const oldKey of activeKeys) {
          await retireKey(oldKey.kid)
          console.log(`   ✅ Retired: ${oldKey.kid}`)
        }
      }

      // Log to audit trail
      const { audit } = await import('../../src/db/schema')
      await db.insert(audit).values({
        actor: 'admin',
        action: 'key_rotated',
        meta: JSON.stringify({
          newKid: newKey.kid,
          retiredKids: options.keepOld ? [] : activeKeys.map(k => k.kid),
          graceful: options.keepOld,
        }),
      })

      console.log('\n✅ Key rotation completed successfully')
      console.log(`   New active key: ${newKey.kid}`)

      if (options.keepOld) {
        console.log('\n📋 Next steps:')
        console.log(`   • Monitor token usage with: gravy session stats`)
        console.log(`   • Retire old keys when safe: gravy key retire <kid>`)
      } else {
        console.log(`   • ${activeKeys.length} key(s) retired`)
        console.log(`   • New tokens will use the new key`)
        console.log(`   • Existing tokens remain valid until expiry`)
      }

      process.exit(0)
    } catch (error) {
      console.error('❌ Key rotation failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Activate key (make it active again)
keyCommands
  .command('activate')
  .description('Activate a retired key')
  .argument('<kid>', 'Key ID to activate')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (kid: string, options: { yes?: boolean }) => {
    try {
      const { db } = await import('../../src/db')
      const { keys } = await import('../../src/db/schema')
      const { eq } = await import('drizzle-orm')

      // Get key details
      const [key] = await db.select().from(keys).where(eq(keys.kid, kid)).limit(1)

      if (!key) {
        console.error(`❌ Key not found: ${kid}`)
        process.exit(1)
      }

      if (key.isActive) {
        console.log(`ℹ️  Key is already active`)
        process.exit(0)
      }

      if (!options.yes) {
        console.log(`⚠️  You are about to activate key: ${kid}`)
        console.log(`   Created: ${key.createdAt.toLocaleString()}`)
        console.log(`   Retired: ${key.retiredAt?.toLocaleString()}`)

        const confirmed = await askConfirmation('\nAre you sure? (y/N): ')
        if (!confirmed) {
          console.log('❌ Operation cancelled.')
          process.exit(0)
        }
      }

      // Activate the key
      await db
        .update(keys)
        .set({
          isActive: true,
          retiredAt: null,
        })
        .where(eq(keys.kid, kid))

      console.log('✅ Key activated successfully')
      console.log(`   Key ID: ${kid}`)
      console.log(`   Status: Active`)

      // Log to audit trail
      const { audit } = await import('../../src/db/schema')
      await db.insert(audit).values({
        actor: 'admin',
        action: 'key_activated',
        meta: JSON.stringify({ kid }),
      })

      process.exit(0)
    } catch (error) {
      console.error('❌ Failed to activate key:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })
