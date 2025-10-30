import { getActivePublicKeys } from '@/services/keyService'
import { exportJWK, importSPKI } from 'jose'
import { jwtVerify, importSPKI as importSPKIJ } from 'jose'
import type { JWTPayload } from '@/types'

/**
 * Verify a JWT using the active public keys (builds a temporary JWKS)
 * @param token - The JWT token to verify
 * @param expectedAudience - Optional expected audience (appId) to validate against
 */
export async function verifyTokenWithJwks(
  token: string,
  expectedAudience?: string
): Promise<JWTPayload> {
  const activeKeys = await getActivePublicKeys()

  // Try each key until one verifies
  for (const key of activeKeys) {
    try {
      const pub = await importSPKIJ(key.publicPem, key.alg)

      const verifyOptions: any = {
        issuer: process.env.JWT_ISSUER || 'http://localhost:3000',
        algorithms: [key.alg],
      }

      // Only validate audience if explicitly provided
      // This allows the introspect endpoint to accept any app's tokens
      if (expectedAudience) {
        verifyOptions.audience = expectedAudience
      }

      const { payload } = await jwtVerify(token, pub as any, verifyOptions)

      return payload as unknown as JWTPayload
    } catch (err) {
      // try next key
    }
  }

  throw new Error('Token verification failed')
}

export interface JWK {
  kty: string
  use: string
  alg: string
  kid: string
  x: string
  y: string
  crv: string
}

/**
 * Convert ES256 public key PEM to JWK format
 */
async function pemToJWK(publicPem: string, kid: string, alg: string): Promise<JWK> {
  const publicKey = await importSPKI(publicPem, alg)

  // Export the key to JWK format using JOSE
  const jwk = await exportJWK(publicKey)

  return {
    kty: jwk.kty!,
    use: 'sig',
    alg,
    kid,
    x: jwk.x!,
    y: jwk.y!,
    crv: jwk.crv!,
  }
}

/**
 * Generate JWKS (JSON Web Key Set) response
 */
export async function generateJWKS() {
  const activeKeys = await getActivePublicKeys()

  const jwks = await Promise.all(activeKeys.map(key => pemToJWK(key.publicPem, key.kid, key.alg)))

  return {
    keys: jwks,
  }
}
