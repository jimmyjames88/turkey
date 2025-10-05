import fetch from 'node-fetch';
import { db } from '../../src/db';
import { tenants } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

export interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  data?: any;
  error?: string;
}

export async function testEndpoint(
  endpoint: string, 
  method: string = 'GET', 
  body?: any,
  headers: Record<string, string> = {}
): Promise<TestResult> {
  try {
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    return {
      endpoint,
      method,
      status: response.status,
      success: response.ok,
      data,
    };
  } catch (error) {
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function logTestResult(result: TestResult): void {
  const status = result.success ? '✅' : '❌';
  console.log(`${status} ${result.method} ${result.endpoint} - ${result.status}`);
  
  if (!result.success) {
    console.log(`   Error: ${result.error || JSON.stringify(result.data)}`);
  } else if (result.data) {
    const responseStr = JSON.stringify(result.data, null, 2);
    const truncated = responseStr.length > 200 ? responseStr.substring(0, 200) + '...' : responseStr;
    console.log(`   Response: ${truncated}`);
  }
  console.log('');
}

export async function createTestTenant(tenantId: string, name?: string): Promise<TestResult> {
  try {
    // Create tenant directly in database
    await db.insert(tenants).values({
      id: tenantId,
      name: name || `Test Tenant ${tenantId}`,
      domain: null,
      isActive: true,
      settings: {},
    });

    return {
      endpoint: 'database',
      method: 'INSERT',
      status: 201,
      success: true,
      data: { tenantId, name: name || `Test Tenant ${tenantId}` }
    };
  } catch (error) {
    // If tenant already exists, that's fine
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return {
        endpoint: 'database',
        method: 'INSERT', 
        status: 200,
        success: true,
        data: { tenantId, message: 'Tenant already exists' }
      };
    }
    
    return {
      endpoint: 'database',
      method: 'INSERT',
      status: 500,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function setupTestTenants(): Promise<void> {
  // Create common test tenants that all tests can use
  const testTenants = [
    'tenant_basic',
    'tenant_advanced', 
    'tenant_admin',
    'tenant_ratelimit',
    'tenant_bruteforce',
    'tenant_refresh',
    'tenant_authtest',
    'tenant_quickauth',
    'tenant_registration',
    'tenant_001'
  ];

  for (const tenantId of testTenants) {
    await createTestTenant(tenantId);
  }
}

export function generateTestUser(suffix: string = '') {
  const timestamp = Date.now();
  const uniqueSuffix = suffix ? `${suffix}_${timestamp}` : timestamp.toString();
  
  return {
    email: `test${uniqueSuffix}@example.com`,
    password: 'SecurePass123!',
    tenantId: `tenant_${suffix || '001'}`,  // Use consistent tenant instead of unique per user
    role: 'user'
  };
}

export function generateAdminUser(suffix: string = '') {
  const timestamp = Date.now();
  const uniqueSuffix = suffix ? `${suffix}_${timestamp}` : timestamp.toString();
  
  return {
    email: `admin${uniqueSuffix}@example.com`,
    password: 'AdminSecure123!',
    tenantId: `tenant_${suffix || '001'}`,  // Use consistent tenant instead of unique per user
    role: 'admin'
  };
}