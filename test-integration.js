#!/usr/bin/env node

// Simple integration test script
const API_BASE = 'http://localhost:3000';

async function testEndpoint(method, path, data = null, headers = {}) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  
  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const status = response.status;
    let body;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    
    console.log(`${method} ${path} -> ${status}`, body ? (typeof body === 'string' ? body.slice(0, 100) : JSON.stringify(body).slice(0, 100)) : '');
    return { status, body };
  } catch (error) {
    console.error(`${method} ${path} -> ERROR:`, error.message);
    return { status: 0, body: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing Frontend-Backend Integration\n');
  
  // Test 1: Health check
  console.log('1️⃣  Health Check:');
  await testEndpoint('GET', '/public/ping');
  
  // Test 2: Auth endpoint (should fail without token)
  console.log('\n2️⃣  Auth Endpoint:');
  await testEndpoint('POST', '/auth/authenticate', { access_token: 'test' });
  
  // Test 3: Protected endpoint (should fail without auth)
  console.log('\n3️⃣  Protected Endpoint:');
  await testEndpoint('GET', '/auth/me');
  
  // Test 4: Database connection check
  console.log('\n4️⃣  Database Connection:');
  await testEndpoint('GET', '/internal/db-ping');
  
  // Test 5: Date validation (from our fixes)
  console.log('\n5️⃣  Date Validation (Fixed):');
  await testEndpoint('POST', '/chores', {
    name: 'Test Chore',
    description: 'Test',
    time: '2032/01/01 00:00:00', // Invalid format - should be rejected
    icon: 'test',
    home_id: '550e8400-e29b-41d4-a716-446655440000',
    points: 10
  });
  
  console.log('\n✅ Integration tests completed!');
}

runTests().catch(console.error);