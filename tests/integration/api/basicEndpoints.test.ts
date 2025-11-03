import {
  testEndpoint,
  logTestResult,
  generateTestUser,
  type TestResult,
} from '../../helpers/testUtils'

/**
 * Integration tests for basic API endpoints
 * Tests core functionality without complex flows
 */
async function testBasicEndpoints() {
  console.log('🧪 Testing Basic API Endpoints\n')

  // Generate consistent test user data
  const testUser = generateTestUser('basic')

  const tests: Array<() => Promise<TestResult>> = [
    // 1. Health Check
    () => testEndpoint('/health'),

    // 2. JWKS Endpoint
    () => testEndpoint('/.well-known/jwks.json'),

    // 3. User Registration (may already exist from previous runs)
    async () => {
      const result = await testEndpoint('/v1/auth/register', 'POST', {
        ...testUser,
        role: 'user',
      })
      // Accept both 201 (new user) and 409 (user already exists)
      if (result.status === 201 || result.status === 409) {
        return { ...result, success: true }
      }
      return result
    },

    // 4. User Login
    () =>
      testEndpoint('/v1/auth/login', 'POST', {
        email: testUser.email,
        password: testUser.password,
        appId: testUser.appId,
      }),
  ]

  const results: TestResult[] = []

  for (const test of tests) {
    const result = await test()
    results.push(result)
    logTestResult(result)
  }

  // If login was successful, test token-based endpoints
  const loginResult = results.find(r => r.endpoint === '/v1/auth/login')
  if (loginResult?.success && loginResult.data?.data?.refreshToken) {
    console.log('🔐 Testing authenticated endpoints...\n')

    const refreshToken = loginResult.data.data.refreshToken

    // Test refresh endpoint
    const refreshResult = await testEndpoint('/v1/auth/refresh', 'POST', {
      refreshToken,
      appId: testUser.appId,
    })
    logTestResult(refreshResult)

    // Test logout
    const logoutResult = await testEndpoint('/v1/auth/logout', 'POST', {
      refreshToken,
      appId: testUser.appId,
    })
    logTestResult(logoutResult)
  }

  console.log('\n🏁 Basic API Testing Complete!')

  // Return summary for test runner
  return {
    total: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  }
}

// Run tests if called directly
if (require.main === module) {
  testBasicEndpoints().catch(console.error)
}

export { testBasicEndpoints }
