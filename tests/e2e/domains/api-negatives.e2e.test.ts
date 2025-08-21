import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

const agent = request(app);

async function json(method: string, url: string, body?: any, headers?: Record<string, string>) {
  let r: any = agent;
  const h = { Connection: 'close', ...(headers || {}) } as Record<string, string>;
  switch (method.toUpperCase()) {
    case 'GET': r = r.get(url); break;
    case 'POST': r = r.post(url).send(body ?? {}); break;
    case 'PATCH': r = r.patch(url).send(body ?? {}); break;
    case 'DELETE': r = r.delete(url).send(body ?? {}); break;
    default: throw new Error(`unsupported method ${method}`);
  }
  r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try { return { status: res.status, json: JSON.parse(text) } as any; }
  catch { return { status: res.status, json: text } as any; }
}

describe('API negatives E2E (auth + not-found + bad-input)', () => {
  const alice = 'neg.alice@e2e.local';
  const bob = 'neg.bob@e2e.local';
  const outsider = 'neg.eve@e2e.local';
  const pw = 'Password1!';
  let tokenA = '';
  let tokenB = '';
  let tokenOut = '';
  let homeId = '';
  let choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails([alice, bob, outsider]);
    tokenA = await supabaseSignupOrLogin(alice, pw);
    tokenB = await supabaseSignupOrLogin(bob, pw);
    tokenOut = await supabaseSignupOrLogin(outsider, pw);

    // Create one home and add Alice and Bob
    const h = await json('POST', '/homes', { name: `Neg Home ${Date.now()}` });
    assert.equal(h.status, 201); homeId = h.json.id;
    await createOrJoinUser(agent as any, alice, 'Neg Alice', homeId);
    await createOrJoinUser(agent as any, bob, 'Neg Bob', homeId);

    // Create a chore (requires auth)
    const c = await json('POST', '/chores', { name: 'Neg Chore', description: 'negatives', time: '2032-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 1 }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(c.status, 201); choreUuid = c.json.uuid;
  }, 30000);

  it('401: missing token on guarded endpoints', async () => {
    assert.equal((await json('GET', `/points/${homeId}`)).status, 401);
    assert.equal((await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: alice })).status, 401);
    assert.equal((await json('GET', `/approvals/${choreUuid}`)).status, 401);
    assert.equal((await agent.patch(`/chores/${choreUuid}/claim`).set({ Connection: 'close' })).status, 401);
    assert.equal((await json('POST', '/disputes', { choreId: choreUuid, reason: 'x' })).status, 401);
  });

  it('403: outsider token blocked from home-scoped resources', async () => {
    const hdr = { Authorization: `Bearer ${tokenOut}` };
    assert.equal((await json('GET', `/points/${homeId}`, undefined, hdr)).status, 403);
    assert.equal((await json('GET', `/approvals/${choreUuid}`, undefined, hdr)).status, 403);
    const claimOut = await agent.patch(`/chores/${choreUuid}/claim`).set({ ...hdr, Connection: 'close' });
    assert.ok([403, 409].includes(claimOut.status));
  });

  it('404: nonexistent resources on valid-auth requests', async () => {
    const hdr = { Authorization: `Bearer ${tokenA}` };
    const fake = '00000000-0000-0000-0000-000000000000';
    // approvals status for missing approval/chore uuid
    assert.equal((await json('GET', `/approvals/${fake}`, undefined, hdr)).status, 404);
    // chore by id not found
    assert.equal((await json('GET', `/chores/${fake}`, undefined, hdr)).status, 404);
    // dispute by id not found
    assert.equal((await json('GET', `/disputes/${fake}`, undefined, hdr)).status, 404);
  });

  it('400: bad input on required params', async () => {
    const hdr = { Authorization: `Bearer ${tokenA}` };
    // disputes list requires homeId query param
    assert.equal((await json('GET', `/disputes`, undefined, hdr)).status, 400);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


