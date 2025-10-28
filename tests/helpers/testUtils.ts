import fetch from 'node-fetch'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

export interface TestResult {
  endpoint: string
  method: string
  status: number
  success: boolean
  data?: any
  error?: string
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
    }

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options)
    const data = await response.json()

    return {
      endpoint,
      method,
      status: response.status,
      success: response.ok,
      data,
    }
  } catch (error) {
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function logTestResult(result: TestResult): void {
  const status = result.success ? '✅' : '❌'
  console.log(`${status} ${result.method} ${result.endpoint} - ${result.status}`)

  if (!result.success) {
    console.log(`   Error: ${result.error || JSON.stringify(result.data)}`)
  } else if (result.data) {
    const responseStr = JSON.stringify(result.data, null, 2)
    const truncated = responseStr.length > 200 ? responseStr.substring(0, 200) + '...' : responseStr
    console.log(`   Response: ${truncated}`)
  }
  console.log('')
}

export async function createTestApp(appId: string): Promise<TestResult> {
  // No-op since we simplified to app-based architecture - return success for compatibility
  return {
    endpoint: 'database',
    method: 'INSERT',
    status: 200,
    success: true,
    data: { appId, message: 'Single app mode - no app creation needed' },
  }
}

export async function setupTestApps(): Promise<void> {
  // No-op since we simplified to app-based architecture
  console.log('Single app mode - no app setup needed')
}

export function generateTestUser(suffix: string = '') {
  const timestamp = Date.now()
  const uniqueSuffix = suffix ? `${suffix}_${timestamp}` : timestamp.toString()

  return {
    email: `test${uniqueSuffix}@example.com`,
    password: 'SecurePass123!',
    role: 'user',
  }
}

export function generateAdminUser(suffix: string = '') {
  const timestamp = Date.now()
  const uniqueSuffix = suffix ? `${suffix}_${timestamp}` : timestamp.toString()

  return {
    email: `admin${uniqueSuffix}@example.com`,
    password: 'AdminSecure123!',
    role: 'admin',
  }
}
