import { testEndpoint, generateTestUser } from '../../helpers/testUtils'

/**
 * Quick test for authentication middleware functionality
 */
async function quickAuthTest() {
  console.log('🔐 Quick Authentication Middleware Test\n')

  // 1. Register a user
  const testUser = generateTestUser('quickauth')
  console.log('1. Registering test user...')

  const registerResult = await testEndpoint('/v1/auth/register', 'POST', {
    ...testUser,
    role: 'user',
  })

  console.log(
    `   Registration: ${registerResult.status === 201 || registerResult.status === 409 ? 'OK' : 'FAILED'} (${registerResult.status})`
  )

  // 2. Login to get token
  console.log('2. Logging in to get token...')
  const loginResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password,
  })

  if (loginResult.status !== 200) {
    console.log(`❌ Login failed: ${loginResult.status}`)
    return false
  }

  const token = loginResult.data?.accessToken
  console.log(`   Login: SUCCESS (token length: ${token?.length})`)

  // 3. Test protected endpoint without token
  console.log('3. Testing protected endpoint without token...')
  const noTokenResult = await testEndpoint('/v1/users/me')
  const noTokenSuccess = noTokenResult.status === 401
  console.log(
    `   ${noTokenSuccess ? '✅' : '❌'} No token: ${noTokenResult.status} (Expected: 401)`
  )

  // 4. Test protected endpoint with token
  console.log('4. Testing protected endpoint with token...')
  const withTokenResult = await testEndpoint('/v1/users/me', 'GET', null, {
    Authorization: `Bearer ${token}`,
  })
  const withTokenSuccess = withTokenResult.status === 200
  console.log(
    `   ${withTokenSuccess ? '✅' : '❌'} With token: ${withTokenResult.status} (Expected: 200)`
  )

  if (withTokenSuccess && withTokenResult.data) {
    console.log(`   User ID: ${withTokenResult.data.user?.id}`)
    console.log(`   Email: ${withTokenResult.data.user?.email}`)
    console.log(`   Role: ${withTokenResult.data.user?.role}`)
  }

  const allSuccess = noTokenSuccess && withTokenSuccess
  console.log(`\n🏁 Quick auth test: ${allSuccess ? 'PASSED' : 'FAILED'}`)

  return allSuccess
}

// Run if called directly
if (require.main === module) {
  quickAuthTest()
    .then(success => process.exit(success ? 0 : 1))
    .catch(console.error)
}

export { quickAuthTest }
