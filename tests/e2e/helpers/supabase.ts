import assert from 'node:assert/strict';

const tokenCache = new Map<string, string>();

export async function supabaseSignupOrLogin(email: string, password: string): Promise<string> {
  if (tokenCache.has(email)) return tokenCache.get(email)!;
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  assert.ok(url && anon, 'Supabase URL and anon key required');

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Attempt signup with limited retries on 429
  let sjson: any = {};
  for (let attempt = 0; attempt < 3; attempt++) {
    const signup = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const sText = await signup.text();
    try { sjson = JSON.parse(sText); } catch { sjson = {}; }
    if (sjson.access_token) {
      tokenCache.set(email, sjson.access_token as string);
      return sjson.access_token as string;
    }
    if (process.env.VERBOSE_TEST_LOGS === 'true') {
      console.warn(`[supabase] signup status=${signup.status} error=${sjson.error || sjson.msg || 'n/a'} msg=${sjson.error_description || sjson.message || 'n/a'}`);
    }
    if (signup.status === 429) {
      await sleep(400 * (attempt + 1));
      continue;
    }
    break;
  }

  // Then try password grant login with small retry budget (covers race/propagation)
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const lText = await login.text();
    let ljson: any = {};
    try { ljson = JSON.parse(lText); } catch { ljson = {}; }
    if (ljson.access_token) {
      tokenCache.set(email, ljson.access_token as string);
      return ljson.access_token as string;
    }
    const retryAfter = login.headers.get('retry-after');
    const ray = login.headers.get('cf-ray');
    const xErr = login.headers.get('x-sb-error-code');
    console.error(`[supabase] login status=${login.status} error=${ljson.error || ljson.msg || 'n/a'} msg=${ljson.error_description || ljson.message || 'n/a'} cf-ray=${ray || 'n/a'} x-sb-error=${xErr || 'n/a'} retry-after=${retryAfter || 'n/a'}`);
    if (login.status === 429) {
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : 300 * (attempt + 1);
      await sleep(waitMs);
      continue;
    }
    await sleep(300 * (attempt + 1));
  }

  assert.fail('Supabase login failed to produce access_token');
}


