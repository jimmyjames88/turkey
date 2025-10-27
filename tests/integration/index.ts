import { testBasicEndpoints } from './api/basicEndpoints.test'
import { testEdgeCases } from './api/edgeCases.test'
import { testAdvancedFlow } from './api/advancedFlow.test'
import { testRateLimiting } from './api/rateLimiting.test'
import { testAuthenticationMiddleware } from './api/authMiddleware.test'
import { testAppAudiences } from './api/appAudiences.test'
// Using development database - no separate test database setup needed

/**
 * Main test runner for all integration tests
 * Runs all test suites and provides a summary
 */
async function runAllIntegrationTests() {
  console.log('🏁 Running All TurKey Integration Tests')
  console.log('=====================================\n')

  const results = {
    basicEndpoints: { total: 0, passed: 0, failed: 0 },
    edgeCases: { total: 0, passed: 0, failed: 0, expectedFailures: 0, testsRun: 0 },
    advancedFlow: { total: 0, passed: 0, failed: 0, expectedFailures: 0 },
    rateLimiting: { total: 0, passed: 0, failed: 0, testsRun: 0 },
    authMiddleware: { total: 0, passed: 0, failed: 0, testsRun: 0 },
    appAudiences: { passedTests: 0, totalTests: 0, allPassed: false },
  }

  try {
    // Using development database directly
    console.log('🔧 Using development database...')
    console.log('✅ Ready to run tests\n')

    // Run basic endpoints tests
    console.log('📋 SUITE 1: Basic Endpoints')
    console.log('----------------------------')
    results.basicEndpoints = await testBasicEndpoints()
    console.log('\n')

    // Small delay between suites to avoid rate limiting conflicts
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Run edge cases tests
    console.log('🚨 SUITE 2: Edge Cases & Error Handling')
    console.log('----------------------------------------')
    results.edgeCases = await testEdgeCases()
    console.log('\n')

    // Small delay between suites
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Run advanced flow tests
    console.log('🚀 SUITE 3: Advanced Authentication Flows')
    console.log('------------------------------------------')
    results.advancedFlow = await testAdvancedFlow()
    console.log('\n')

    // Small delay between suites
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Run rate limiting tests
    console.log('🛡️  SUITE 4: Rate Limiting & Security')
    console.log('------------------------------------')
    results.rateLimiting = await testRateLimiting()
    console.log('\n')

    // Small delay between suites
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Run authentication middleware tests
    console.log('🔐 SUITE 5: Authentication Middleware')
    console.log('------------------------------------')
    results.authMiddleware = await testAuthenticationMiddleware()
    console.log('\n')

    // Small delay between suites
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Run app-specific audiences tests
    console.log('🎯 SUITE 6: App-Specific JWT Audiences')
    console.log('--------------------------------------')
    results.appAudiences = await testAppAudiences()
    console.log('\n')

    // Print summary
    console.log('📊 INTEGRATION TEST SUMMARY')
    console.log('============================')

    const totalTests =
      results.basicEndpoints.total +
      results.edgeCases.total +
      results.advancedFlow.total +
      results.rateLimiting.total +
      results.authMiddleware.total +
      results.appAudiences.totalTests
    const totalPassed =
      results.basicEndpoints.passed +
      results.edgeCases.passed +
      results.advancedFlow.passed +
      results.rateLimiting.passed +
      results.authMiddleware.passed +
      results.appAudiences.passedTests
    const totalFailed =
      results.basicEndpoints.failed +
      results.edgeCases.failed +
      results.advancedFlow.failed +
      results.rateLimiting.failed +
      results.authMiddleware.failed +
      (results.appAudiences.totalTests - results.appAudiences.passedTests)
    const totalExpectedFailures =
      results.edgeCases.expectedFailures + results.advancedFlow.expectedFailures

    console.log(`✅ Total Tests: ${totalTests}`)
    console.log(`✅ Passed: ${totalPassed}`)
    console.log(`❌ Failed: ${totalFailed}`)
    console.log(
      `🎯 Expected Failures: ${totalExpectedFailures} (security validations working correctly)`
    )
    console.log(
      `🛡️  Rate Limiting Tests: ${results.rateLimiting.passed}/${results.rateLimiting.total} passed`
    )
    console.log(
      `🔐 Auth Middleware Tests: ${results.authMiddleware.passed}/${results.authMiddleware.total} passed`
    )
    console.log(
      `🎯 App Audiences Tests: ${results.appAudiences.passedTests}/${results.appAudiences.totalTests} passed`
    )
    console.log(`📈 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`)

    if (totalFailed === 0) {
      console.log('\n🎉 All integration tests passed!')
      return true
    } else {
      console.log(`\n⚠️  ${totalFailed} tests failed unexpectedly.`)
      return false
    }
  } catch (error) {
    console.error('❌ Integration test suite failed:', error)
    return false
  } finally {
    // No cleanup needed for development database
    console.log('🧹 Tests completed')
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllIntegrationTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

export { runAllIntegrationTests }
