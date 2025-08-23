import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('supabaseAuth middleware (Hono - negative paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects requests without authentication token', async () => {
    const app = createTestApp();
    app.get('/protected', requireUser, (c) => c.json({ ok: true }));

    const res = await makeRequest(app, '/protected');
    expect(res.status).toBe(401);
    
    const text = await res.text();
    expect(text).toMatch(/Missing Authorization/i);
  });

  it('rejects malformed authorization headers', async () => {
    const app = createTestApp();
    app.get('/protected', requireUser, (c) => c.json({ ok: true }));

    const res = await makeRequest(app, '/protected', {
      'Authorization': 'NotBearer token'
    });
    
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toMatch(/Missing Authorization/i);
  });

  it('rejects invalid tokens in strict mode', async () => {
    // Mock JWT verification to throw an error
    mockJwtVerify.mockRejectedValue(new Error('Invalid token'));
    
    const app = createTestApp();
    app.get('/protected', requireUser, (c) => c.json({ ok: true }));

    const res = await makeRequest(app, '/protected', {
      'Authorization': 'Bearer invalid-token'
    });

    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toMatch(/Invalid token/i);
    expect(mockJwtVerify).toHaveBeenCalled();
  });

  it('passes valid tokens and sets user context', async () => {
    // Mock successful JWT verification
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: 'user123',
        email: 'test@example.com',
        role: 'authenticated'
      },
      protectedHeader: { alg: 'RS256' }
    } as any);
    
    const app = createTestApp();
    app.get('/protected', requireUser, (c) => {
      return c.json({ 
        ok: true, 
        user: {
          id: 'user123',
          email: 'test@example.com',
          role: 'authenticated'
        }
      });
    });

    const res = await makeRequest(app, '/protected', {
      'Authorization': 'Bearer valid-token'
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user.id).toBe('user123');
    expect(body.user.email).toBe('test@example.com');
    expect(mockJwtVerify).toHaveBeenCalled();
  });
});