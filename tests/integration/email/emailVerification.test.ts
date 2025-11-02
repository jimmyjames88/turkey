/**
 * Email Verification Flow Integration Tests
 *
 * Tests the complete email verification flow including:
 * - Registration sends verification email
 * - Verify email with token
 * - Login blocked if verification required
 * - Resend verification email
 * - Rate limiting
 * - Already verified handling
 */

import { testEndpoint, logTestResult, generateTestUser } from '../../helpers/testUtils'

const testUser = generateTestUser('email-verify')

export async function runEmailVerificationTests() {
  console.log('\n✉️  Email Verification Flow Tests')
  console.log('='.repeat(60))

  // Test 1: Register user (should send verification email)
  console.log('\n1️⃣  Registering user (should trigger verification email)...')
  const registerResult = await testEndpoint('/v1/auth/register', 'POST', {
    email: testUser.email,
    password: testUser.password,
    role: 'user',
  })
  logTestResult(registerResult)

  if (registerResult.success) {
    console.log('   ✅ Verification email would be sent (check logs for token)')
    console.log('   ℹ️  Manual step: Extract verification token from server logs or email')
  } else if (
    registerResult.status === 400 &&
    registerResult.data?.error?.includes('already exists')
  ) {
    console.log('   ⚠️  User already exists, skipping to next tests...')
  }

  // Test 2: Check if login is blocked when email not verified (if REQUIRE_EMAIL_VERIFICATION=true)
  console.log('\n2️⃣  Testing login with unverified email...')
  const unverifiedLoginResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password,
  })

  if (unverifiedLoginResult.status === 403) {
    console.log('   ✅ Login blocked for unverified email (REQUIRE_EMAIL_VERIFICATION=true)')
  } else if (unverifiedLoginResult.success) {
    console.log('   ℹ️  Login allowed (REQUIRE_EMAIL_VERIFICATION=false or email already verified)')
  } else {
    logTestResult(unverifiedLoginResult)
  }

  // Test 3: Resend verification email
  console.log('\n3️⃣  Testing resend verification email...')
  const resendResult = await testEndpoint('/v1/auth/resend-verification', 'POST', {
    email: testUser.email,
  })
  logTestResult(resendResult)

  if (resendResult.success) {
    console.log('   ✅ Verification email resent successfully')
  }

  // Test 4: Resend for non-existent user (should not reveal)
  console.log('\n4️⃣  Testing email enumeration prevention on resend...')
  const enumResult = await testEndpoint('/v1/auth/resend-verification', 'POST', {
    email: 'nonexistent@example.com',
  })
  logTestResult(enumResult)

  if (enumResult.status === 200) {
    console.log('   ✅ Server does not reveal if email exists (security feature)')
  }

  // Test 5: Test rate limiting on resend
  console.log('\n5️⃣  Testing resend verification rate limiting...')
  const rateLimitTests = []
  for (let i = 0; i < 6; i++) {
    rateLimitTests.push(
      testEndpoint('/v1/auth/resend-verification', 'POST', {
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

  // Test 6: Verify email with invalid token
  console.log('\n6️⃣  Testing email verification with invalid token...')
  const invalidTokenResult = await testEndpoint('/v1/auth/verify-email', 'POST', {
    token: 'invalid-token-12345',
  })
  logTestResult(invalidTokenResult)

  if (invalidTokenResult.status === 400) {
    console.log('   ✅ Server rejects invalid verification tokens')
  }

  // Manual testing instructions
  console.log('\n📋 Manual Testing Required:')
  console.log('   To complete end-to-end email verification testing:')
  console.log(`   1. Check server logs or email for verification token sent to ${testUser.email}`)
  console.log('   2. Verify email using the token:')
  console.log('      POST /v1/auth/verify-email')
  console.log('      { "token": "<from-email>" }')
  console.log('   3. Should receive welcome email after verification')
  console.log('   4. Login should succeed after verification:')
  console.log('      POST /v1/auth/login')
  console.log(`      { "email": "${testUser.email}", "password": "${testUser.password}" }`)
  console.log('   5. Token should be single-use (reusing should fail)')
  console.log('   6. Resending to verified email should succeed but not send email')

  console.log('\n✅ Email Verification Tests Complete')
  console.log('='.repeat(60))
}
