import {
  testEndpoint,
  logTestResult,
  generateTestUser,
  type TestResult,
} from '../../helpers/testUtils'

/**
 * Integration tests for app-specific JWT audiences
 * Tests security isolation between different applications
 */
async function testAppAudiences() {
  console.log('🎯 Testing App-Specific JWT Audiences\n')

  const tests: Array<() => Promise<TestResult>> = [
    // Test login with specific audience
    async () => {
      const user = generateTestUser('aud1')
      user.tenantId = 'tenant_001' // Use existing tenant

      // Register user first
      await testEndpoint('/v1/auth/register', 'POST', user)

      // Login with blog audience
      const loginData = {
        email: user.email,
        password: user.password,
        tenantId: user.tenantId,
        audience: 'my_blog',
      }

      const result = await testEndpoint('/v1/auth/login', 'POST', loginData)

      if (result.success && result.data?.accessToken) {
        // Decode JWT to verify audience (basic decode, no verification)
        const base64Payload = result.data.accessToken.split('.')[1]
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString())

        if (payload.aud === 'my_blog') {
          return { ...result, success: true }
        } else {
          return {
            ...result,
            success: false,
            error: `Expected audience 'my_blog', got '${payload.aud}'`,
          }
        }
      }

      return result
    },

    // Test login with different audiences for different apps
    async () => {
      const user = generateTestUser('aud2')
      user.tenantId = 'tenant_001' // Use existing tenant

      // Register user
      await testEndpoint('/v1/auth/register', 'POST', user)

      // Login for photos app
      const photosLogin = await testEndpoint('/v1/auth/login', 'POST', {
        email: user.email,
        password: user.password,
        tenantId: user.tenantId,
        audience: 'my_photos',
      })

      // Login for finance app
      const financeLogin = await testEndpoint('/v1/auth/login', 'POST', {
        email: user.email,
        password: user.password,
        tenantId: user.tenantId,
        audience: 'my_finance',
      })

      if (photosLogin.success && financeLogin.success) {
        // Decode both tokens
        const photosPayload = JSON.parse(
          Buffer.from(photosLogin.data.accessToken.split('.')[1], 'base64').toString()
        )
        const financePayload = JSON.parse(
          Buffer.from(financeLogin.data.accessToken.split('.')[1], 'base64').toString()
        )

        if (photosPayload.aud === 'my_photos' && financePayload.aud === 'my_finance') {
          return {
            endpoint: '/v1/auth/login',
            method: 'POST',
            status: 200,
            success: true,
            data: { message: 'Different audiences created successfully' },
          }
        } else {
          return {
            endpoint: '/v1/auth/login',
            method: 'POST',
            status: 200,
            success: false,
            error: 'Audience mismatch in tokens',
          }
        }
      }

      return {
        endpoint: '/v1/auth/login',
        method: 'POST',
        status: 400,
        success: false,
        error: 'Failed to create tokens for different apps',
      }
    },

    // Test default audience when not specified
    async () => {
      const user = generateTestUser('aud3')
      user.tenantId = 'tenant_001' // Use existing tenant

      // Register user
      await testEndpoint('/v1/auth/register', 'POST', user)

      // Login without audience
      const result = await testEndpoint('/v1/auth/login', 'POST', {
        email: user.email,
        password: user.password,
        tenantId: user.tenantId,
        // No audience specified
      })

      if (result.success && result.data?.accessToken) {
        const payload = JSON.parse(
          Buffer.from(result.data.accessToken.split('.')[1], 'base64').toString()
        )

        // Should use default audience (turkey or configured value)
        if (payload.aud === 'turkey' || payload.aud) {
          return { ...result, success: true }
        } else {
          return { ...result, success: false, error: 'No audience in token' }
        }
      }

      return result
    },

    // Test invalid audience format rejection
    async () => {
      const user = generateTestUser('aud4')
      user.tenantId = 'tenant_001' // Use existing tenant

      // Register user
      await testEndpoint('/v1/auth/register', 'POST', user)

      // Try login with invalid audience (contains space)
      const result = await testEndpoint('/v1/auth/login', 'POST', {
        email: user.email,
        password: user.password,
        tenantId: user.tenantId,
        audience: 'my blog', // Invalid: contains space
      })

      // Should be rejected with 400
      if (result.status === 400 && !result.success) {
        return {
          ...result,
          success: true,
          data: { message: 'Invalid audience correctly rejected' },
        }
      } else {
        return { ...result, success: false, error: 'Invalid audience was not rejected' }
      }
    },

    // Test refresh with audience
    async () => {
      const user = generateTestUser('aud5')
      user.tenantId = 'tenant_001' // Use existing tenant

      // Register user
      await testEndpoint('/v1/auth/register', 'POST', user)

      // Login to get refresh token
      const loginResult = await testEndpoint('/v1/auth/login', 'POST', {
        email: user.email,
        password: user.password,
        tenantId: user.tenantId,
        audience: 'my_blog',
      })

      if (loginResult.success && loginResult.data?.refreshToken) {
        // Refresh with same audience
        const refreshResult = await testEndpoint('/v1/auth/refresh', 'POST', {
          refreshToken: loginResult.data.refreshToken,
          audience: 'my_blog',
        })

        if (refreshResult.success && refreshResult.data?.accessToken) {
          const payload = JSON.parse(
            Buffer.from(refreshResult.data.accessToken.split('.')[1], 'base64').toString()
          )

          if (payload.aud === 'my_blog') {
            return { ...refreshResult, success: true }
          } else {
            return { ...refreshResult, success: false, error: 'Refresh token has wrong audience' }
          }
        }

        return refreshResult
      }

      return {
        endpoint: '/v1/auth/refresh',
        method: 'POST',
        status: 400,
        success: false,
        error: 'Failed to get refresh token',
      }
    },

    // Test register with audience
    async () => {
      const user = generateTestUser('finance_reg')
      user.tenantId = 'tenant_001' // Use existing tenant
      const userData = {
        ...user,
        audience: 'my_finance',
      }

      const result = await testEndpoint('/v1/auth/register', 'POST', userData)

      // If user already exists (409), that's okay - we can still test the audience functionality
      if (result.status === 409) {
        // Try login instead to get a token with the audience
        const loginResult = await testEndpoint('/v1/auth/login', 'POST', {
          email: user.email,
          password: user.password,
          tenantId: user.tenantId,
          audience: 'my_finance',
        })

        if (loginResult.success && loginResult.data?.accessToken) {
          const payload = JSON.parse(
            Buffer.from(loginResult.data.accessToken.split('.')[1], 'base64').toString()
          )

          if (payload.aud === 'my_finance') {
            return { ...loginResult, success: true }
          } else {
            return {
              ...loginResult,
              success: false,
              error: `Expected audience 'my_finance', got '${payload.aud}'`,
            }
          }
        }

        return loginResult
      }

      if (result.success && result.data?.accessToken) {
        const payload = JSON.parse(
          Buffer.from(result.data.accessToken.split('.')[1], 'base64').toString()
        )

        if (payload.aud === 'my_finance') {
          return { ...result, success: true }
        } else {
          return {
            ...result,
            success: false,
            error: `Expected audience 'my_finance', got '${payload.aud}'`,
          }
        }
      }

      return result
    },
  ]

  const results = await Promise.all(tests.map(test => test()))

  results.forEach((result, index) => {
    const testNames = [
      'Login with specific audience (my_blog)',
      'Different audiences for different apps',
      'Default audience when not specified',
      'Invalid audience format rejection',
      'Refresh token with audience',
      'Register with audience',
    ]

    console.log(`🎯 ${testNames[index]}`)
    logTestResult(result)
  })

  const passedTests = results.filter(r => r.success).length
  const totalTests = results.length

  console.log(`\n🎯 App-Specific Audiences: ${passedTests}/${totalTests} tests passed\n`)

  return { passedTests, totalTests, allPassed: passedTests === totalTests }
}

export { testAppAudiences }
