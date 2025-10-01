import { Router } from 'express';
import { generateJWKS } from '@/services/jwksService';

const router = Router();

/**
 * GET /.well-known/jwks.json
 * Returns the JSON Web Key Set for public key verification
 */
router.get('/jwks.json', async (req, res) => {
  try {
    const jwks = await generateJWKS();
    
    // Cache for 15 minutes, allow stale while revalidating
    res.set({
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=300',
      'Content-Type': 'application/json',
    });
    
    res.json(jwks);
  } catch (error) {
    console.error('Error generating JWKS:', error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Unable to generate JWKS',
    });
  }
});

export default router;