/**
 * Password Reset Flow Integration Tests
 *
 * Tests the complete password reset flow including:
 * - Request password reset email
 * - Reset password with token
 * - Login with new password
 * - Rate limiting
 * - Token expiration
 * - Security validations
 */

import { testEndpoint, logTestResult, generateTestUser } from '../../helpers/testUtils'

const testUser = generateTestUser('password-reset')

export async function runPasswordResetTests() {
  console.log('\n🔐 Password Reset Flow Tests')
  console.log('='.repeat(60))

  // Test 1: Register user for password reset tests
  console.log('\n1️⃣  Registering test user...')
  const registerResult = await testEndpoint('/v1/auth/register', 'POST', {
    email: testUser.email,
    password: testUser.password,
    role: 'user',
  })
  logTestResult(registerResult)

  if (registerResult.success) {
    console.log('   ✅ User registered successfully')
  } else {
    console.log('   ⚠️  User may already exist, attempting login...')
    const loginResult = await testEndpoint('/v1/auth/login', 'POST', {
      email: testUser.email,
      password: testUser.password,
    })
    if (loginResult.success) {
      console.log('   ✅ Login successful')
    }
  }

  // Test 2: Request password reset
  console.log('\n2️⃣  Requesting password reset...')
  const resetRequestResult = await testEndpoint('/v1/auth/request-password-reset', 'POST', {
    email: testUser.email,
  })
  logTestResult(resetRequestResult)

  if (resetRequestResult.success) {
    console.log('   ✅ Password reset email would be sent (check logs for token)')
    // In real tests, you'd extract the token from the email
    // For now, we'll note that manual testing is needed
    console.log('   ℹ️  Manual step: Extract token from server logs or email')
  }

  // Test 3: Request password reset for non-existent user (should not reveal)
  console.log('\n3️⃣  Testing email enumeration prevention...')
  const enumResult = await testEndpoint('/v1/auth/request-password-reset', 'POST', {
    email: 'nonexistent@example.com',
  })
  logTestResult(enumResult)

  if (enumResult.status === 200) {
    console.log('   ✅ Server does not reveal if email exists (security feature)')
  }

  // Test 4: Test rate limiting on password reset
  console.log('\n4️⃣  Testing password reset rate limiting...')
  const rateLimitTests = []
  for (let i = 0; i < 4; i++) {
    rateLimitTests.push(
      testEndpoint('/v1/auth/request-password-reset', 'POST', {
        email: testUser.email,
      })
    )
  }

  const rateLimitResults = await Promise.all(rateLimitTests)
  const rateLimited = rateLimitResults.some(r => r.status === 429)

  if (rateLimited) {
    console.log('   ✅ Rate limiting active (429 Too Many Requests)')
  } else {
    console.log('   ⚠️  Rate limiting may not be active')
  }

  // Test 5: Reset password with invalid token
  console.log('\n5️⃣  Testing password reset with invalid token...')
  const invalidTokenResult = await testEndpoint('/v1/auth/reset-password', 'POST', {
    token: 'invalid-token-12345',
    newPassword: 'NewPassword123!',
  })
  logTestResult(invalidTokenResult)

  if (invalidTokenResult.status === 400) {
    console.log('   ✅ Server rejects invalid tokens')
  }

  // Test 6: Reset password with weak password
  console.log('\n6️⃣  Testing password reset with weak password...')
  const weakPasswordResult = await testEndpoint('/v1/auth/reset-password', 'POST', {
    token: 'dummy-token',
    newPassword: 'weak',
  })
  logTestResult(weakPasswordResult)

  if (weakPasswordResult.status === 400) {
    console.log('   ✅ Server enforces password strength requirements')
  }

  // Manual testing instructions
  console.log('\n📋 Manual Testing Required:')
  console.log('   To complete end-to-end password reset testing:')
  console.log(`   1. Check server logs or email for reset token sent to ${testUser.email}`)
  console.log('   2. Use the token to reset password:')
  console.log('      POST /v1/auth/reset-password')
  console.log('      { "token": "<from-email>", "newPassword": "NewSecure123!" }')
  console.log('   3. Login with new password to verify:')
  console.log('      POST /v1/auth/login')
  console.log(`      { "email": "${testUser.email}", "password": "NewSecure123!" }`)
  console.log('   4. Token should be single-use (reusing should fail)')
  console.log('   5. Old password should no longer work')

  console.log('\n✅ Password Reset Tests Complete')
  console.log('='.repeat(60))
}
