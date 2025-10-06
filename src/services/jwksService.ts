import { getActivePublicKeys } from '@/services/keyService'
import { exportJWK, importSPKI } from 'jose'

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
