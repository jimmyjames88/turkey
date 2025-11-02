/**
 * Email Provider Integration Tests
 *
 * Tests email provider configuration and functionality:
 * - EMAIL_SERVICE not configured (graceful degradation)
 * - Mailgun provider
 * - SMTP provider
 * - Provider switching
 */

import { testEndpoint, logTestResult } from '../../helpers/testUtils'

export async function runEmailProviderTests() {
  console.log('\n📧 Email Provider Configuration Tests')
  console.log('='.repeat(60))

  // Test 1: Check current email service configuration
  console.log('\n1️⃣  Checking email service configuration...')
  console.log(`   EMAIL_SERVICE: ${process.env.EMAIL_SERVICE || 'not set'}`)

  if (!process.env.EMAIL_SERVICE) {
    console.log('   ⚠️  Email service disabled (EMAIL_SERVICE not set)')
    console.log('   ℹ️  Email features will log warnings but not fail')
  } else if (process.env.EMAIL_SERVICE === 'mailgun') {
    console.log('   ✅ Mailgun configured')
    console.log(`      - Domain: ${process.env.MAILGUN_DOMAIN || 'not set'}`)
    console.log(
      `      - API Key: ${process.env.MAILGUN_API_KEY ? '***' + process.env.MAILGUN_API_KEY.slice(-4) : 'not set'}`
    )
  } else if (process.env.EMAIL_SERVICE === 'smtp') {
    console.log('   ✅ SMTP configured')
    console.log(`      - Host: ${process.env.SMTP_HOST || 'not set'}`)
    console.log(`      - Port: ${process.env.SMTP_PORT || 'not set'}`)
    console.log(`      - Secure: ${process.env.SMTP_SECURE || 'not set'}`)
    console.log(`      - User: ${process.env.SMTP_USER || 'not set'}`)
  } else {
    console.log(`   ❌ Invalid EMAIL_SERVICE value: ${process.env.EMAIL_SERVICE}`)
  }

  // Test 2: Test email-dependent endpoint behavior
  console.log('\n2️⃣  Testing password reset with current email configuration...')
  const testEmail = 'provider-test@example.com'
  const resetResult = await testEndpoint('/v1/auth/request-password-reset', 'POST', {
    email: testEmail,
  })
  logTestResult(resetResult)

  if (resetResult.success) {
    if (!process.env.EMAIL_SERVICE) {
      console.log('   ✅ Endpoint succeeds even without email configured (graceful degradation)')
    } else {
      console.log('   ✅ Email sent successfully via configured provider')
    }
  }

  // Test 3: Configuration validation
  console.log('\n3️⃣  Validating email provider configuration...')
  const warnings = []

  if (process.env.EMAIL_SERVICE === 'mailgun') {
    if (!process.env.MAILGUN_API_KEY) warnings.push('MAILGUN_API_KEY not set')
    if (!process.env.MAILGUN_DOMAIN) warnings.push('MAILGUN_DOMAIN not set')
  } else if (process.env.EMAIL_SERVICE === 'smtp') {
    if (!process.env.SMTP_HOST) warnings.push('SMTP_HOST not set')
    if (!process.env.SMTP_PORT) warnings.push('SMTP_PORT not set')
    if (!process.env.SMTP_USER) warnings.push('SMTP_USER not set')
    if (!process.env.SMTP_PASSWORD) warnings.push('SMTP_PASSWORD not set')
  }

  if (warnings.length > 0) {
    console.log('   ⚠️  Configuration warnings:')
    warnings.forEach(w => console.log(`      - ${w}`))
  } else if (process.env.EMAIL_SERVICE) {
    console.log('   ✅ All required configuration variables set')
  } else {
    console.log('   ℹ️  Email service disabled (no configuration needed)')
  }

  // Documentation
  console.log('\n📋 Email Provider Setup:')
  console.log('\n   Mailgun Configuration:')
  console.log('      EMAIL_SERVICE=mailgun')
  console.log('      MAILGUN_API_KEY=your-api-key')
  console.log('      MAILGUN_DOMAIN=your-domain.mailgun.org')
  console.log('      EMAIL_FROM=noreply@yourdomain.com')
  console.log('      EMAIL_FROM_NAME="TurKey Auth"')

  console.log('\n   SMTP Configuration:')
  console.log('      EMAIL_SERVICE=smtp')
  console.log('      SMTP_HOST=smtp.gmail.com')
  console.log('      SMTP_PORT=587')
  console.log('      SMTP_SECURE=false')
  console.log('      SMTP_USER=your-email@gmail.com')
  console.log('      SMTP_PASSWORD=your-app-password')
  console.log('      EMAIL_FROM=noreply@yourdomain.com')
  console.log('      EMAIL_FROM_NAME="TurKey Auth"')

  console.log('\n   Disable Email:')
  console.log("      # Just don't set EMAIL_SERVICE")
  console.log("      # Email features will log warnings but won't fail")

  console.log('\n✅ Email Provider Tests Complete')
  console.log('='.repeat(60))
}
