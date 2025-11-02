/**
 * Email Integration Tests Entry Point
 *
 * Runs all email-related integration tests:
 * - Password reset flow
 * - Email verification flow
 * - Email provider configuration
 */

import { runPasswordResetTests } from './passwordReset.test'
import { runEmailVerificationTests } from './emailVerification.test'
import { runEmailProviderTests } from './emailProviders.test'

export async function runEmailTests() {
  console.log('\n' + '='.repeat(60))
  console.log('📧 EMAIL INTEGRATION TESTS')
  console.log('='.repeat(60))

  try {
    await runEmailProviderTests()
    await runPasswordResetTests()
    await runEmailVerificationTests()

    console.log('\n' + '='.repeat(60))
    console.log('✅ ALL EMAIL TESTS COMPLETE')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('\n❌ Email tests failed:', error)
    throw error
  }
}

// Allow running email tests independently
if (require.main === module) {
  runEmailTests()
    .then(() => {
      console.log('\n✨ Email test suite finished successfully')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 Email test suite failed:', error)
      process.exit(1)
    })
}
