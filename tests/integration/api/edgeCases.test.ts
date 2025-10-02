import { testEndpoint, logTestResult, generateTestUser } from '../../helpers/testUtils';

/**
 * Integration tests for edge cases and error handling
 * Tests security validations and error responses
 */
async function testEdgeCases() {
  console.log('🧪 Testing Edge Cases and Error Handling\n');

  const results = [];

  // Test 1: Invalid registration (weak password) - SHOULD FAIL with 400
  console.log('Testing weak password validation...');
  const weakPasswordResult = await testEndpoint('/v1/auth/register', 'POST', {
    email: 'weak@example.com',
    password: '123', // Weak password
    tenantId: 'tenant_001'
  });
  
  const weakPasswordSuccess = weakPasswordResult.status === 400;
  console.log(`${weakPasswordSuccess ? '✅' : '❌'} POST /v1/auth/register - ${weakPasswordResult.status} (Expected: 400)`);
  if (weakPasswordResult.data) {
    console.log(`   Response: ${JSON.stringify(weakPasswordResult.data).substring(0, 200)}...`);
  }
  console.log('');
  results.push({ name: 'weak password', success: weakPasswordSuccess });

  // Test 2: Duplicate user registration - SHOULD FAIL with 409
  console.log('Testing duplicate user prevention...');
  
  // First, create a user
  const testUser = {
    email: 'duplicate-test@example.com',
    password: 'SecurePass123!',
    tenantId: 'tenant_duplicate_test',
    role: 'user'
  };
  
  const firstResult = await testEndpoint('/v1/auth/register', 'POST', testUser);
  
  // Then try to create the same user again
  const duplicateResult = await testEndpoint('/v1/auth/register', 'POST', testUser);
  
  const duplicateSuccess = duplicateResult.status === 409;
  console.log(`${duplicateSuccess ? '✅' : '❌'} POST /v1/auth/register - ${duplicateResult.status} (Expected: 409)`);
  if (duplicateResult.data) {
    console.log(`   Response: ${JSON.stringify(duplicateResult.data).substring(0, 200)}...`);
  }
  console.log('');
  results.push({ name: 'duplicate user', success: duplicateSuccess });

  // Test 3: Invalid login credentials - SHOULD FAIL with 401
  console.log('Testing invalid login credentials...');
  const invalidLoginResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: 'testbasic@example.com',
    password: 'WrongPassword123!',
    tenantId: 'tenant_basic'
  });
  
  const invalidLoginSuccess = invalidLoginResult.status === 401;
  console.log(`${invalidLoginSuccess ? '✅' : '❌'} POST /v1/auth/login - ${invalidLoginResult.status} (Expected: 401)`);
  if (invalidLoginResult.data) {
    console.log(`   Response: ${JSON.stringify(invalidLoginResult.data).substring(0, 200)}...`);
  }
  console.log('');
  results.push({ name: 'invalid credentials', success: invalidLoginSuccess });

  // Test 4: Invalid refresh token - SHOULD FAIL with 401
  console.log('Testing invalid refresh token...');
  const invalidRefreshResult = await testEndpoint('/v1/auth/refresh', 'POST', {
    refreshToken: 'rt_invalid_token_here'
  });
  
  const invalidRefreshSuccess = invalidRefreshResult.status === 401;
  console.log(`${invalidRefreshSuccess ? '✅' : '❌'} POST /v1/auth/refresh - ${invalidRefreshResult.status} (Expected: 401)`);
  if (invalidRefreshResult.data) {
    console.log(`   Response: ${JSON.stringify(invalidRefreshResult.data).substring(0, 200)}...`);
  }
  console.log('');
  results.push({ name: 'invalid refresh', success: invalidRefreshSuccess });

  // Test 5: Cross-tenant access - SHOULD FAIL with 401
  console.log('Testing cross-tenant access prevention...');
  const crossTenantResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: 'testbasic@example.com',
    password: 'SecurePass123!',
    tenantId: 'different_tenant' // Different tenant
  });
  
  const crossTenantSuccess = crossTenantResult.status === 401;
  console.log(`${crossTenantSuccess ? '✅' : '❌'} POST /v1/auth/login - ${crossTenantResult.status} (Expected: 401)`);
  if (crossTenantResult.data) {
    console.log(`   Response: ${JSON.stringify(crossTenantResult.data).substring(0, 200)}...`);
  }
  console.log('');
  results.push({ name: 'cross-tenant', success: crossTenantSuccess });

  // Test 6: Missing required fields - SHOULD FAIL with 400
  console.log('Testing missing required fields...');
  const missingFieldsResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: 'test@example.com'
    // Missing password and tenantId
  });
  
  const missingFieldsSuccess = missingFieldsResult.status === 400;
  console.log(`${missingFieldsSuccess ? '✅' : '❌'} POST /v1/auth/login - ${missingFieldsResult.status} (Expected: 400)`);
  if (missingFieldsResult.data) {
    console.log(`   Response: ${JSON.stringify(missingFieldsResult.data).substring(0, 200)}...`);
  }
  console.log('');
  results.push({ name: 'missing fields', success: missingFieldsSuccess });

  console.log('🏁 Edge Case Testing Complete!');

  // Calculate results
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;

  return { 
    total: totalTests, 
    passed: passedTests, 
    failed: failedTests,
    expectedFailures: totalTests, // All these tests are expected to "fail" (return error codes)
    testsRun: totalTests 
  };
}

// Run tests if called directly
if (require.main === module) {
  testEdgeCases().catch(console.error);
}

export { testEdgeCases };