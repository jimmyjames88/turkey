import { testEndpoint, generateTestUser } from '../../helpers/testUtils';

/**
 * Integration tests for authentication middleware and protected routes
 * Tests JWT validation, role-based access, and tenant isolation
 */
async function testAuthenticationMiddleware() {
  console.log('🔐 Testing Authentication Middleware & Protected Routes\n');

  const results = [];
  let userToken = '';
  let adminToken = '';

  // Test 1: Register and login a regular user
  console.log('1. Setting up test users...');
  const testUser = generateTestUser('authtest');
  
  const userRegResult = await testEndpoint('/v1/auth/register', 'POST', {
    ...testUser,
    tenantId: 'tenant_authtest',
    role: 'user'
  });
  
  const userRegSuccess = userRegResult.status === 201 || userRegResult.status === 409;
  console.log(`   User registration: ${userRegSuccess ? 'OK' : 'FAILED'} (${userRegResult.status})`);
  
  // Login user to get token
  const userLoginResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password,
    tenantId: 'tenant_authtest'
  });
  
  if (userLoginResult.status === 200 && userLoginResult.data?.accessToken) {
    userToken = userLoginResult.data.accessToken;
    console.log(`   User login: SUCCESS (token length: ${userToken.length})`);
  } else {
    console.log(`   User login: FAILED (${userLoginResult.status})`);
  }

  // Test 2: Register and login an admin user
  const adminUser = generateTestUser('admin');
  
  const adminRegResult = await testEndpoint('/v1/auth/register', 'POST', {
    ...adminUser,
    tenantId: 'tenant_admin',
    role: 'admin'
  });
  
  const adminRegSuccess = adminRegResult.status === 201 || adminRegResult.status === 409;
  console.log(`   Admin registration: ${adminRegSuccess ? 'OK' : 'FAILED'} (${adminRegResult.status})`);
  
  // Login admin to get token
  const adminLoginResult = await testEndpoint('/v1/auth/login', 'POST', {
    email: adminUser.email,
    password: adminUser.password,
    tenantId: 'tenant_admin'
  });
  
  if (adminLoginResult.status === 200 && adminLoginResult.data?.accessToken) {
    adminToken = adminLoginResult.data.accessToken;
    console.log(`   Admin login: SUCCESS (token length: ${adminToken.length})`);
  } else {
    console.log(`   Admin login: FAILED (${adminLoginResult.status})`);
  }
  
  console.log('');

  // Test 3: Access protected route without token (should fail)
  console.log('2. Testing access without authentication...');
  const noAuthResult = await testEndpoint('/v1/users/me');
  
  const noAuthSuccess = noAuthResult.status === 401;
  console.log(`${noAuthSuccess ? '✅' : '❌'} GET /v1/users/me (no token) - ${noAuthResult.status} (Expected: 401)`);
  if (noAuthResult.data) {
    console.log(`   Response: ${JSON.stringify(noAuthResult.data)}`);
  }
  console.log('');
  results.push({ name: 'no auth protection', success: noAuthSuccess });

  // Test 4: Access protected route with invalid token (should fail)
  console.log('3. Testing access with invalid token...');
  const invalidAuthResult = await testEndpoint('/v1/users/me', 'GET', null, {
    Authorization: 'Bearer invalid_token_here'
  });
  
  const invalidAuthSuccess = invalidAuthResult.status === 401;
  console.log(`${invalidAuthSuccess ? '✅' : '❌'} GET /v1/users/me (invalid token) - ${invalidAuthResult.status} (Expected: 401)`);
  if (invalidAuthResult.data) {
    console.log(`   Response: ${JSON.stringify(invalidAuthResult.data)}`);
  }
  console.log('');
  results.push({ name: 'invalid token protection', success: invalidAuthSuccess });

  // Test 5: Access protected route with valid user token (should succeed)
  console.log('4. Testing authenticated access with user token...');
  if (userToken) {
    const userAuthResult = await testEndpoint('/v1/users/me', 'GET', null, {
      Authorization: `Bearer ${userToken}`
    });
    
    const userAuthSuccess = userAuthResult.status === 200;
    console.log(`${userAuthSuccess ? '✅' : '❌'} GET /v1/users/me (user token) - ${userAuthResult.status} (Expected: 200)`);
    if (userAuthResult.data) {
      console.log(`   User ID: ${userAuthResult.data.user?.id}`);
      console.log(`   Email: ${userAuthResult.data.user?.email}`);
      console.log(`   Role: ${userAuthResult.data.user?.role}`);
      console.log(`   Tenant: ${userAuthResult.data.user?.tenantId}`);
    }
    console.log('');
    results.push({ name: 'user auth success', success: userAuthSuccess });
  } else {
    console.log('❌ Skipping user auth test - no user token available');
    results.push({ name: 'user auth success', success: false });
  }

  // Test 6: Test role-based access - user accessing user endpoint (should succeed)
  console.log('5. Testing role-based access - user role...');
  if (userToken) {
    const userRoleResult = await testEndpoint('/v1/users/profile', 'GET', null, {
      Authorization: `Bearer ${userToken}`
    });
    
    const userRoleSuccess = userRoleResult.status === 200;
    console.log(`${userRoleSuccess ? '✅' : '❌'} GET /v1/users/profile (user token) - ${userRoleResult.status} (Expected: 200)`);
    console.log('');
    results.push({ name: 'user role access', success: userRoleSuccess });
  } else {
    results.push({ name: 'user role access', success: false });
  }

  // Test 7: Test role-based access - user accessing admin endpoint (should fail)
  console.log('6. Testing role-based access - admin-only endpoint...');
  if (userToken) {
    const userAdminResult = await testEndpoint('/v1/users/admin-only', 'GET', null, {
      Authorization: `Bearer ${userToken}`
    });
    
    const userAdminSuccess = userAdminResult.status === 403;
    console.log(`${userAdminSuccess ? '✅' : '❌'} GET /v1/users/admin-only (user token) - ${userAdminResult.status} (Expected: 403)`);
    if (userAdminResult.data) {
      console.log(`   Response: ${JSON.stringify(userAdminResult.data)}`);
    }
    console.log('');
    results.push({ name: 'admin access denial', success: userAdminSuccess });
  } else {
    results.push({ name: 'admin access denial', success: false });
  }

  // Test 8: Test admin access (should succeed)
  console.log('7. Testing admin access...');
  if (adminToken) {
    const adminAccessResult = await testEndpoint('/v1/users/admin-only', 'GET', null, {
      Authorization: `Bearer ${adminToken}`
    });
    
    const adminAccessSuccess = adminAccessResult.status === 200;
    console.log(`${adminAccessSuccess ? '✅' : '❌'} GET /v1/users/admin-only (admin token) - ${adminAccessResult.status} (Expected: 200)`);
    if (adminAccessResult.data) {
      console.log(`   Admin capabilities: ${adminAccessResult.data.adminCapabilities?.join(', ')}`);
    }
    console.log('');
    results.push({ name: 'admin access success', success: adminAccessSuccess });
  } else {
    results.push({ name: 'admin access success', success: false });
  }

  // Test 9: Test tenant isolation
  console.log('8. Testing tenant isolation...');
  if (userToken) {
    const tenantResult = await testEndpoint('/v1/users/tenant-info', 'GET', null, {
      Authorization: `Bearer ${userToken}`
    });
    
    const tenantSuccess = tenantResult.status === 200;
    console.log(`${tenantSuccess ? '✅' : '❌'} GET /v1/users/tenant-info (user token) - ${tenantResult.status} (Expected: 200)`);
    if (tenantResult.data) {
      console.log(`   Tenant ID: ${tenantResult.data.tenantId}`);
      console.log(`   User count in tenant: ${tenantResult.data.userCount}`);
    }
    console.log('');
    results.push({ name: 'tenant isolation', success: tenantSuccess });
  } else {
    results.push({ name: 'tenant isolation', success: false });
  }

  // Test 10: Test token validation details
  console.log('9. Testing token validation details...');
  if (userToken) {
    const tokenTestResult = await testEndpoint('/v1/users/test-auth', 'POST', {}, {
      Authorization: `Bearer ${userToken}`
    });
    
    const tokenTestSuccess = tokenTestResult.status === 200;
    console.log(`${tokenTestSuccess ? '✅' : '❌'} POST /v1/users/test-auth (user token) - ${tokenTestResult.status} (Expected: 200)`);
    if (tokenTestResult.data?.tokenValidation) {
      const tv = tokenTestResult.data.tokenValidation;
      console.log(`   Token JTI: ${tv.tokenClaims?.jti}`);
      console.log(`   Issued at: ${tv.tokenClaims?.iat}`);
      console.log(`   Expires at: ${tv.tokenClaims?.exp}`);
      console.log(`   Time until expiry: ${tv.tokenClaims?.timeUntilExpiry}`);
    }
    console.log('');
    results.push({ name: 'token validation', success: tokenTestSuccess });
  } else {
    results.push({ name: 'token validation', success: false });
  }

  console.log('🏁 Authentication Middleware Testing Complete!');

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
  testAuthenticationMiddleware().catch(console.error);
}

export { testAuthenticationMiddleware };