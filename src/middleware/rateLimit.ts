// Simple in-memory token bucket per IP. Suitable for staging/low scale.
// Upgrade to Durable Object or KV-backed limiter for production traffic.

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

const TOKENS = 3000;       // burst (increased from 60)
const REFILL_MS = 60_000; // per minute

export function rateLimit() {
  return async (c, next) => {
    // Skip rate limiting in test environments
    const isTest = (c.env as any)?.NODE_ENV === 'test' || process.env.NODE_ENV === 'test';
    if (isTest) {
      return next();
    }
    
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    let b = buckets.get(ip);

    if (!b) {
      b = { tokens: TOKENS, updatedAt: now };
      buckets.set(ip, b);
    } else {
      const elapsed = now - b.updatedAt;
      if (elapsed > 0) {
        const refill = Math.floor(elapsed / REFILL_MS) * TOKENS;
        b.tokens = Math.min(TOKENS, b.tokens + refill);
        b.updatedAt = now;
      }
    }

    if (b.tokens <= 0) {
      return c.text('Too Many Requests', 429);
    }

    b.tokens -= 1;
    return next();
  };
}