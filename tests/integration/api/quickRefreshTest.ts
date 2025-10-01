import { testEndpoint, generateTestUser } from '../../helpers/testUtils';

/**
 * Quick test specifically for the refresh token rate limiting issue
 */
async function testRefreshTokenRateLimit() {
  console.log('🔄 Testing Refresh Token Rate Limiting Fix\n');

  // Use a dedicated user for this test
  const refreshUser = generateTestUser('quickrefresh');
  
  console.log('1. Registering test user...');
  const registerResult = await testEndpoint('/v1/auth/register', 'POST', {
    ...refreshUser,
    tenantId: 'tenant_quickrefresh'
  });
  
  const registerStatus = registerResult.status === 201 || registerResult.status === 409;
  console.log(`   Registration: ${registerStatus ? 'OK' : 'FAILED'} (${registerResult.status})`);
  
  console.log('2. Getting initial login...');
  const loginResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: refreshUser.email,
    password: refreshUser.password,
    tenantId: 'tenant_quickrefresh'
  });
  
  console.log(`   Login: ${loginResult.status === 200 ? 'SUCCESS' : 'FAILED'} (${loginResult.status})`);
  
  if (loginResult.status === 200 && loginResult.data?.refreshToken) {
    console.log('3. Testing refresh token...');
    
    const refreshResult = await testEndpoint('/v1/auth/refresh', 'POST', {
      refreshToken: loginResult.data.refreshToken
    });
    
    console.log(`   Refresh: ${refreshResult.status === 200 ? 'SUCCESS' : 'FAILED'} (${refreshResult.status})`);
    
    if (refreshResult.status === 200) {
      console.log('✅ Refresh token rate limiting test PASSED');
      return true;
    } else {
      console.log('❌ Refresh token rate limiting test FAILED');
      console.log(`   Error: ${JSON.stringify(refreshResult.data)}`);
      return false;
    }
  } else {
    console.log('❌ Could not get initial login token');
    console.log(`   Error: ${JSON.stringify(loginResult.data)}`);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  testRefreshTokenRateLimit()
    .then(success => {
      console.log(`\n🏁 Test ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

export { testRefreshTokenRateLimit };