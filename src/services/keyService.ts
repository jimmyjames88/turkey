import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose'
import { randomBytes } from 'crypto'
import { db } from '@/db'
import { keys } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export interface KeyPair {
  kid: string
  publicKey: any // CryptoKey - using any for Node.js compatibility
  privateKey: any // CryptoKey - using any for Node.js compatibility
  publicPem: string
  privatePem: string
}

/**
 * Generate a new ES256 key pair for JWT signing
 */
export async function generateES256KeyPair(): Promise<KeyPair> {
  const { publicKey, privateKey } = await generateKeyPair('ES256')

  const kid = generateKid()
  const publicPem = await exportSPKI(publicKey)
  const privatePem = await exportPKCS8(privateKey)

  return {
    kid,
    publicKey,
    privateKey,
    publicPem,
    privatePem,
  }
}

/**
 * Generate a unique key identifier
 */
export function generateKid(): string {
  return 'key_' + randomBytes(16).toString('hex')
}

/**
 * Store a key pair in the database
 */
export async function storeKeyPair(keyPair: KeyPair): Promise<void> {
  await db.insert(keys).values({
    kid: keyPair.kid,
    alg: 'ES256',
    publicPem: keyPair.publicPem,
    privatePem: keyPair.privatePem, // TODO: Encrypt this in production
    isActive: true,
  })
}

// Cache for active signing key to avoid repeated DB queries
let cachedSigningKey: KeyPair | null = null

/**
 * Get the current active signing key with lazy initialization
 */
export async function getActiveSigningKey(): Promise<KeyPair | null> {
  // Return cached key if available
  if (cachedSigningKey) {
    return cachedSigningKey
  }

  // Try to get key from database
  const [activeKey] = await db
    .select()
    .from(keys)
    .where(and(eq(keys.isActive, true), eq(keys.alg, 'ES256')))
    .orderBy(keys.createdAt)
    .limit(1)

  if (!activeKey) {
    // No key exists - generate one automatically
    console.log('🔑 No signing key found, generating one automatically...')
    try {
      const keyPair = await generateES256KeyPair()
      await storeKeyPair(keyPair)
      console.log(`🔑 Auto-generated key pair with kid: ${keyPair.kid}`)

      // Cache the new key
      cachedSigningKey = keyPair
      return keyPair
    } catch (error) {
      console.error('❌ Failed to auto-generate signing key:', error)
      return null
    }
  }

  // Import keys from PEM
  const { importPKCS8, importSPKI } = await import('jose')
  const privateKey = await importPKCS8(activeKey.privatePem, 'ES256')
  const publicKey = await importSPKI(activeKey.publicPem, 'ES256')

  const keyPair = {
    kid: activeKey.kid,
    publicKey,
    privateKey,
    publicPem: activeKey.publicPem,
    privatePem: activeKey.privatePem,
  }

  // Cache for future use
  cachedSigningKey = keyPair
  return keyPair
}

/**
 * Get all active public keys for JWKS
 */
export async function getActivePublicKeys() {
  const activeKeys = await db
    .select({
      kid: keys.kid,
      alg: keys.alg,
      publicPem: keys.publicPem,
    })
    .from(keys)
    .where(eq(keys.isActive, true))

  return activeKeys
}

/**
 * Retire a key (mark as inactive)
 */
export async function retireKey(kid: string): Promise<void> {
  await db
    .update(keys)
    .set({
      isActive: false,
      retiredAt: new Date(),
    })
    .where(eq(keys.kid, kid))
}

/**
 * Initialize the key management system with a default key pair
 */
export async function initializeKeyManagement(): Promise<void> {
  const existingKey = await getActiveSigningKey()

  if (!existingKey) {
    console.log('🔑 Generating initial ES256 key pair...')
    const keyPair = await generateES256KeyPair()
    await storeKeyPair(keyPair)
    console.log(`🔑 Generated key pair with kid: ${keyPair.kid}`)
  } else {
    console.log(`🔑 Using existing key pair with kid: ${existingKey.kid}`)
  }
}
