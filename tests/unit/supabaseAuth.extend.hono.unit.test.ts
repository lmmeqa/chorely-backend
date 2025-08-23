import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jose for JWT verification - avoid hoisting issues
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn(() => vi.fn())
}));

// Import after mocking
import { requireUser } from '../../src/lib/auth';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Get mocked functions
const mockJwtVerify = vi.mocked(jwtVerify);
const mockCreateRemoteJWKSet = vi.mocked(createRemoteJWKSet);

// Helper to create test app
function createTestApp() {
  const app = new Hono();
  
  // Set up test environment
  app.use('*', async (c, next) => {
    c.env = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_JWT_SECRET: 'test-jwt-secret',
      STRICT_AUTH: 'true'
    };
    await next();
  });
  
  return app;
}

// Helper to make request
function makeRequest(app: Hono, path: string, headers?: Record<string, string>) {
  const request = new Request(`http://localhost${path}`, { headers });
  const testEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_JWT_SECRET: 'test-jwt-secret',
    STRICT_AUTH: 'true'
  };
  return app.fetch(request, testEnv);
}

describe('supabaseAuth middleware (extended - Hono)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed Authorization header', async () => {
    const app = createTestApp();
    app.get('/p', requireUser, (c) => c.json({ ok: true }));
    
    const res = await makeRequest(app, '/p', { 'Authorization': 'Token abc' });
    expect(res.status).toBe(401);
    
    const text = await res.text();
    expect(text).toMatch(/Missing Authorization/i);
  });

  it('rejects empty Bearer token', async () => {
    const app = createTestApp();
    app.get('/p', requireUser, (c) => c.json({ ok: true }));
    
    const res = await makeRequest(app, '/p', { 'Authorization': 'Bearer ' });
    expect(res.status).toBe(401);
    
    const text = await res.text();
    expect(text).toMatch(/Missing Authorization/i);
  });

  it('handles JWT verification errors gracefully', async () => {
    mockJwtVerify.mockRejectedValue(new Error('Token expired'));
    
    const app = createTestApp();
    app.get('/p', requireUser, (c) => c.json({ ok: true }));
    
    const res = await makeRequest(app, '/p', { 'Authorization': 'Bearer expired-token' });
    expect(res.status).toBe(401);
    
    const text = await res.text();
    expect(text).toMatch(/Invalid token/i);
  });
});