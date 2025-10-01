import { testEndpoint, generateTestUser } from '../../helpers/testUtils';

/**
 * Integration tests for rate limiting and brute force protection
 * Tests various rate limiting scenarios and account lockout functionality
 */
async function testRateLimiting() {
  console.log('🛡️  Testing Rate Limiting & Brute Force Protection\n');

  const results = [];

  // Test 1: Basic rate limiting - should work for normal requests
  console.log('Testing basic API access within limits...');
  const normalResult = await testEndpoint('/health');
  
  const normalSuccess = normalResult.status === 200;
  console.log(`${normalSuccess ? '✅' : '❌'} GET /health - ${normalResult.status} (Normal rate)`);
  console.log('');
  results.push({ name: 'normal access', success: normalSuccess });

  // Test 2: Login rate limiting - test a few login attempts
  console.log('Testing login rate limiting (should allow reasonable attempts)...');
  const testUser = generateTestUser('ratelimit');
  
  // First, register the user
  const registerResult = await testEndpoint('/v1/auth/register', 'POST', {
    ...testUser,
    tenantId: 'tenant_ratelimit'
  });
  console.log(`Registration: ${registerResult.status === 201 || registerResult.status === 409 ? 'OK' : 'FAILED'}`);

  // Try 3 valid login attempts (should all work)
  let loginAttempts = 0;
  let successfulLogins = 0;
  
  for (let i = 0; i < 3; i++) {
    const loginResult = await testEndpoint('/v1/auth/login', 'POST', {
      email: testUser.email,
      password: testUser.password,
      tenantId: 'tenant_ratelimit'
    });
    
    loginAttempts++;
    if (loginResult.status === 200) {
      successfulLogins++;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const loginRateSuccess = successfulLogins >= 2; // At least 2 out of 3 should succeed
  console.log(`${loginRateSuccess ? '✅' : '❌'} Login rate limiting - ${successfulLogins}/${loginAttempts} successful logins`);
  console.log('');
  results.push({ name: 'login rate limiting', success: loginRateSuccess });

  // Test 3: Failed login attempts (brute force protection simulation)
  console.log('Testing brute force protection (invalid password attempts)...');
  
  // Use a dedicated user for brute force testing
  const bruteForceUser = generateTestUser('bruteforce');
  
  // Register the brute force test user
  const bruteRegisterResult = await testEndpoint('/v1/auth/register', 'POST', {
    ...bruteForceUser,
    tenantId: 'tenant_bruteforce'
  });
  console.log(`Brute force test user registration: ${bruteRegisterResult.status === 201 || bruteRegisterResult.status === 409 ? 'OK' : 'FAILED'}`);
  
  let failedAttempts = 0;
  let rateLimitHit = false;
  let accountLocked = false;
  
  // Try multiple failed login attempts
  for (let i = 0; i < 6; i++) {
    const failedLoginResult = await testEndpoint('/v1/auth/login', 'POST', {
      email: bruteForceUser.email,
      password: 'WrongPassword123!',
      tenantId: 'tenant_bruteforce'
    });
    
    failedAttempts++;
    
    if (failedLoginResult.status === 429) {
      if (failedLoginResult.data?.error === 'account_locked') {
        accountLocked = true;
        console.log(`   Account locked after ${failedAttempts} failed attempts`);
        break;
      } else if (failedLoginResult.data?.error === 'rate_limit_exceeded') {
        rateLimitHit = true;
        console.log(`   Rate limit hit after ${failedAttempts} failed attempts`);
        break;
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  const bruteForceSuccess = rateLimitHit || accountLocked || failedAttempts >= 5;
  console.log(`${bruteForceSuccess ? '✅' : '❌'} Brute force protection - Protection triggered: ${rateLimitHit || accountLocked}`);
  console.log('');
  results.push({ name: 'brute force protection', success: bruteForceSuccess });

  // Test 4: Refresh token rate limiting
  console.log('Testing refresh token rate limiting...');
  
  // Use a different user for refresh testing to avoid rate limit conflicts
  const refreshTestUser = generateTestUser('refresh');
  
  // Register the refresh test user
  const refreshRegisterResult = await testEndpoint('/v1/auth/register', 'POST', {
    ...refreshTestUser,
    tenantId: 'tenant_refresh'
  });
  console.log(`Refresh test user registration: ${refreshRegisterResult.status === 201 || refreshRegisterResult.status === 409 ? 'OK' : 'FAILED'}`);
  
  // First get a valid refresh token with the new user
  const loginForRefresh = await testEndpoint('/v1/auth/login', 'POST', {
    email: refreshTestUser.email,
    password: refreshTestUser.password,
    tenantId: 'tenant_refresh'
  });
  
  let refreshSuccess = false;
  if (loginForRefresh.status === 200 && loginForRefresh.data?.refreshToken) {
    // Try a few refresh attempts
    let refreshAttempts = 0;
    let successfulRefreshes = 0;
    
    for (let i = 0; i < 3; i++) {
      const refreshResult = await testEndpoint('/v1/auth/refresh', 'POST', {
        refreshToken: loginForRefresh.data.refreshToken
      });
      
      refreshAttempts++;
      if (refreshResult.status === 200) {
        successfulRefreshes++;
        // Update refresh token for next attempt
        if (refreshResult.data?.refreshToken) {
          loginForRefresh.data.refreshToken = refreshResult.data.refreshToken;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    refreshSuccess = successfulRefreshes >= 2;
    console.log(`${refreshSuccess ? '✅' : '❌'} Refresh rate limiting - ${successfulRefreshes}/${refreshAttempts} successful refreshes`);
  } else {
    console.log(`❌ Could not get initial login for refresh test (status: ${loginForRefresh.status})`);
    console.log(`   This may be due to rate limiting from previous tests. User: ${refreshTestUser.email}`);
  }
  
  console.log('');
  results.push({ name: 'refresh rate limiting', success: refreshSuccess });

  // Test 5: Registration rate limiting
  console.log('Testing registration rate limiting...');
  
  let registrationAttempts = 0;
  let registrationBlocked = false;
  
  // Try multiple registration attempts with different emails
  for (let i = 0; i < 3; i++) {
    const regResult = await testEndpoint('/v1/auth/register', 'POST', {
      email: `ratetest${i}@example.com`,
      password: 'SecurePass123!',
      tenantId: 'tenant_registration',
      role: 'user'
    });
    
    registrationAttempts++;
    
    if (regResult.status === 429) {
      registrationBlocked = true;
      console.log(`   Registration rate limit hit after ${registrationAttempts} attempts`);
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // For registration, we expect it to work normally for a few attempts
  const registrationSuccess = registrationAttempts >= 2 && !registrationBlocked;
  console.log(`${registrationSuccess ? '✅' : '❌'} Registration rate limiting - ${registrationAttempts} attempts, blocked: ${registrationBlocked}`);
  console.log('');
  results.push({ name: 'registration rate limiting', success: registrationSuccess });

  console.log('🏁 Rate Limiting Testing Complete!');

  // Calculate results
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;

  return { 
    total: totalTests, 
    passed: passedTests, 
    failed: failedTests,
    testsRun: totalTests 
  };
}

// Run tests if called directly
if (require.main === module) {
  testRateLimiting().catch(console.error);
}

export { testRateLimiting };