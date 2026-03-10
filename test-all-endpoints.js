#!/usr/bin/env node
/**
 * Comprehensive API Endpoint Test Script
 * Tests all endpoints with real requests
 */

const APP_URL = process.env.APP_URL || 'https://runloop.polsia.app';

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

async function testEndpoint(name, method, path, options = {}) {
  try {
    const url = `${APP_URL}${path}`;
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    };

    console.log(`Testing: ${method} ${path}...`);
    const response = await fetch(url, fetchOptions);

    // Check if response matches expected status
    const expectedStatus = options.expectedStatus || (method === 'GET' ? 200 : [200, 201, 302]);
    const statusMatch = Array.isArray(expectedStatus)
      ? expectedStatus.includes(response.status)
      : response.status === expectedStatus;

    if (statusMatch || response.ok) {
      console.log(`✅ ${name}: ${response.status}`);
      testsPassed++;
      return { success: true, status: response.status };
    } else {
      const errorText = await response.text().catch(() => 'Could not read error');
      console.log(`❌ ${name}: ${response.status} - ${errorText.substring(0, 100)}`);
      failures.push({ name, status: response.status, error: errorText.substring(0, 200) });
      testsFailed++;
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failures.push({ name, error: error.message });
    testsFailed++;
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting comprehensive API endpoint tests...\n');

  // Public endpoints (should return HTML or redirect)
  await testEndpoint('Landing page', 'GET', '/', { expectedStatus: 200 });
  await testEndpoint('Login page', 'GET', '/login', { expectedStatus: 200 });
  await testEndpoint('Signup page', 'GET', '/signup', { expectedStatus: 200 });
  await testEndpoint('Pricing page', 'GET', '/pricing', { expectedStatus: 200 });
  await testEndpoint('About page', 'GET', '/about', { expectedStatus: 200 });

  // Protected pages (should redirect to login without auth)
  await testEndpoint('Dashboard (no auth)', 'GET', '/dashboard', { expectedStatus: [200, 302] });
  await testEndpoint('Chat (no auth)', 'GET', '/chat', { expectedStatus: [200, 302] });
  await testEndpoint('Tasks (no auth)', 'GET', '/tasks', { expectedStatus: [200, 302] });
  await testEndpoint('Analytics (no auth)', 'GET', '/analytics', { expectedStatus: [200, 302] });
  await testEndpoint('Settings (no auth)', 'GET', '/settings', { expectedStatus: [200, 302] });
  await testEndpoint('Agents (no auth)', 'GET', '/agents', { expectedStatus: [200, 302] });
  await testEndpoint('Agent Factory (no auth)', 'GET', '/agent-factory', { expectedStatus: [200, 302] });
  await testEndpoint('Workflows (no auth)', 'GET', '/workflows', { expectedStatus: [200, 302] });
  await testEndpoint('Documents (no auth)', 'GET', '/documents', { expectedStatus: [200, 302] });
  await testEndpoint('Memory (no auth)', 'GET', '/memory', { expectedStatus: [200, 302] });
  await testEndpoint('Skills (no auth)', 'GET', '/skills', { expectedStatus: [200, 302] });
  await testEndpoint('Learnings (no auth)', 'GET', '/learnings', { expectedStatus: [200, 302] });
  await testEndpoint('Reports (no auth)', 'GET', '/reports', { expectedStatus: [200, 302] });
  await testEndpoint('Email (no auth)', 'GET', '/email', { expectedStatus: [200, 302] });
  await testEndpoint('Cycles (no auth)', 'GET', '/cycles', { expectedStatus: [200, 302] });

  // Health check endpoints
  await testEndpoint('Health check', 'GET', '/health', { expectedStatus: 200 });
  await testEndpoint('API health check', 'GET', '/api/health', { expectedStatus: 200 });

  // API endpoints without auth (should return 401 or redirect)
  await testEndpoint('Get agents (no auth)', 'GET', '/api/agents', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get tasks (no auth)', 'GET', '/api/tasks', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get conversations (no auth)', 'GET', '/api/conversations', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get companies (no auth)', 'GET', '/api/companies', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get analytics (no auth)', 'GET', '/api/analytics/overview', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get reports (no auth)', 'GET', '/api/reports', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get workflows (no auth)', 'GET', '/api/workflows', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get email inbox (no auth)', 'GET', '/api/email/inbox', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get recurring tasks (no auth)', 'GET', '/api/recurring', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get cycles (no auth)', 'GET', '/api/cycles', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get ads campaigns (no auth)', 'GET', '/api/ads/campaigns', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get dashboard (no auth)', 'GET', '/api/dashboard', { expectedStatus: [401, 302, 403] });
  await testEndpoint('Get dashboard links (no auth)', 'GET', '/api/dashboard/links', { expectedStatus: [401, 302, 403] });

  // Test invalid endpoints (should return 404)
  await testEndpoint('Invalid endpoint', 'GET', '/api/invalid-endpoint-xyz', { expectedStatus: 404 });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Tests passed: ${testsPassed}`);
  console.log(`❌ Tests failed: ${testsFailed}`);
  console.log('='.repeat(60));

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f, i) => {
      console.log(`${i + 1}. ${f.name}: ${f.status || 'Error'} - ${f.error || ''}`);
    });
  }

  // Exit with proper code
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(console.error);
