import { testBasicEndpoints } from './api/basicEndpoints.test';
import { testEdgeCases } from './api/edgeCases.test';
import { testAdvancedFlow } from './api/advancedFlow.test';

/**
 * Main test runner for all integration tests
 * Runs all test suites and provides a summary
 */
async function runAllIntegrationTests() {
  console.log('🏁 Running All TurKey Integration Tests');
  console.log('=====================================\n');

  const results = {
    basicEndpoints: { total: 0, passed: 0, failed: 0 },
    edgeCases: { total: 0, passed: 0, failed: 0, expectedFailures: 0, testsRun: 0 },
    advancedFlow: { total: 0, passed: 0, failed: 0, expectedFailures: 0 }
  };

  try {
    // Run basic endpoints tests
    console.log('📋 SUITE 1: Basic Endpoints');
    console.log('----------------------------');
    results.basicEndpoints = await testBasicEndpoints();
    console.log('\n');

    // Run edge cases tests
    console.log('🚨 SUITE 2: Edge Cases & Error Handling');
    console.log('----------------------------------------');
    results.edgeCases = await testEdgeCases();
    console.log('\n');

    // Run advanced flow tests
    console.log('🚀 SUITE 3: Advanced Authentication Flows');
    console.log('------------------------------------------');
    results.advancedFlow = await testAdvancedFlow();
    console.log('\n');

    // Print summary
    console.log('📊 INTEGRATION TEST SUMMARY');
    console.log('============================');
    
    const totalTests = results.basicEndpoints.total + results.edgeCases.total + results.advancedFlow.total;
    const totalPassed = results.basicEndpoints.passed + results.edgeCases.passed + results.advancedFlow.passed;
    const totalFailed = results.basicEndpoints.failed + results.edgeCases.failed + results.advancedFlow.failed;
    const totalExpectedFailures = results.edgeCases.expectedFailures + results.advancedFlow.expectedFailures;

    console.log(`✅ Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`🎯 Expected Failures: ${totalExpectedFailures} (security validations working correctly)`);
    console.log(`📈 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

    if (totalFailed === 0) {
      console.log('\n🎉 All integration tests passed!');
      return true;
    } else {
      console.log(`\n⚠️  ${totalFailed} tests failed unexpectedly.`);
      return false;
    }

  } catch (error) {
    console.error('❌ Integration test suite failed:', error);
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllIntegrationTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { runAllIntegrationTests };