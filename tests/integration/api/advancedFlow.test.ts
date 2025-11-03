import { testEndpoint, logTestResult, generateTestUser } from '../../helpers/testUtils'

/**
 * Integration tests for advanced authentication flows
 * Tests complex multi-step authentication scenarios
 */
async function testAdvancedFlow() {
  console.log('🚀 Testing Advanced Authentication Flow\n')

  // Generate consistent test user data
  const testUser = generateTestUser('advanced')

  let userData: any = null
  let loginData: any = null
  let refreshData: any = null

  // 1. Register a new user (may already exist from previous runs)
  console.log('1. Registering new admin user...')
  const registerResult = await testEndpoint('/v1/auth/register', 'POST', {
    ...testUser,
  })

  // Accept both 201 (new user) and 409 (user already exists)
  const registerSuccess = registerResult.status === 201 || registerResult.status === 409
  const adjustedRegisterResult = { ...registerResult, success: registerSuccess }
  logTestResult(adjustedRegisterResult)

  if (registerResult.status === 201 && registerResult.data) {
    userData = registerResult.data
    console.log(`   User ID: ${userData.user?.id}`)
  }

  // 2. Login to get fresh tokens
  console.log('2. Logging in...')
  const loginResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password,
    appId: testUser.appId,
  })
  logTestResult(loginResult)

  if (loginResult.success) {
    loginData = loginResult.data.data
    console.log(`   Access Token Length: ${loginData.accessToken?.length}`)
    console.log(`   Refresh Token: ${loginData.refreshToken?.substring(0, 20)}...`)
  }

  // 3. Use refresh token to get new access token
  console.log('3. Refreshing access token...')
  const refreshResult = await testEndpoint('/v1/auth/refresh', 'POST', {
    refreshToken: loginData?.refreshToken,
    appId: testUser.appId,
  })
  logTestResult(refreshResult)

  if (refreshResult.success) {
    refreshData = refreshResult.data.data
    console.log(`   New Access Token Length: ${refreshData.accessToken?.length}`)
    console.log(`   New Refresh Token: ${refreshData.refreshToken?.substring(0, 20)}...`)
  }

  // 4. Test logout-all (global logout)
  console.log('4. Testing global logout...')
  const logoutAllResult = await testEndpoint('/v1/auth/logout-all', 'POST', {
    refreshToken: refreshData?.refreshToken,
    appId: testUser.appId,
  })
  logTestResult(logoutAllResult)

  if (logoutAllResult.success) {
    console.log(`   Message: ${logoutAllResult.data?.message}`)
  }

  // 5. Try to use the refresh token after global logout (should fail)
  console.log('5. Testing refresh token after global logout (should fail)...')
  const postLogoutRefreshResult = await testEndpoint('/v1/auth/refresh', 'POST', {
    refreshToken: refreshData?.refreshToken,
    appId: testUser.appId,
  })

  // This should fail
  const status = !postLogoutRefreshResult.success ? '✅' : '❌'
  console.log(
    `${status} POST /v1/auth/refresh - ${postLogoutRefreshResult.status} (Expected Failure)`
  )
  if (!postLogoutRefreshResult.success) {
    console.log(`   Error: ${postLogoutRefreshResult.data?.error}`)
  }
  console.log('')

  // 6. Verify user can login again after global logout
  console.log('6. Testing fresh login after global logout...')
  const freshLoginResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password,
    appId: testUser.appId,
  })
  logTestResult(freshLoginResult)

  console.log('🏁 Advanced Flow Testing Complete!')

  // Return test summary
  const allResults = [
    adjustedRegisterResult,
    loginResult,
    refreshResult,
    logoutAllResult,
    freshLoginResult,
  ]
  const expectedFailure = !postLogoutRefreshResult.success // This should fail

  return {
    total: allResults.length + 1, // +1 for the expected failure test
    passed: allResults.filter(r => r.success).length + (expectedFailure ? 1 : 0),
    failed: allResults.filter(r => !r.success).length + (expectedFailure ? 0 : 1),
    expectedFailures: expectedFailure ? 1 : 0,
  }
}

// Run tests if called directly
if (require.main === module) {
  testAdvancedFlow().catch(console.error)
}

export { testAdvancedFlow }
