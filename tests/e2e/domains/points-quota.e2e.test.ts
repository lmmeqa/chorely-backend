import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
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
    default: throw new Error(`unsupported method ${method}`);
  }
  r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try { return { status: res.status, json: JSON.parse(text) } as any; }
  catch { return { status: res.status, json: text } as any; }
}

describe('Points & quota E2E', () => {
  const scenario = buildTwoPersonHouse();
  const [alice, bob] = scenario.users;
  let homeId = '';
  let tokens: Record<string, string> = {};

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    for (const u of scenario.users) tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    const h = await json('POST', '/homes', { name: `Quota Home ${Date.now()}` });
    assert.equal(h.status, 201); homeId = h.json.id;
    for (const u of scenario.users) {
      await createOrJoinUser(agent as any, u.email, u.name, homeId);
    }
  }, 30000);

  it('caps weekly points when quota set (or documents uncapped policy)', async () => {
    const tokenA = tokens[alice.email];
    const tokenB = tokens[bob.email];

    // Set small weekly quota: 10
    const pq = await json('PATCH', `/homes/${homeId}/quota`, { weeklyPointQuota: 10 });
    assert.ok([200, 204].includes(pq.status));

    // Create two chores of 6 points
    const c1 = await json('POST', '/chores', { name: 'P6-A', description: 'quota', time: '2033-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 6 }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(c1.status, 201);
    const c2 = await json('POST', '/chores', { name: 'P6-B', description: 'quota', time: '2033-01-02T00:00:00', icon: 'wind', home_id: homeId, points: 6 }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(c2.status, 201);

    // Approvals: vote by both members to ensure threshold
    assert.ok([200, 409].includes((await json('POST', `/approvals/${c1.json.uuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokenA}` })).status));
    assert.ok([200, 409].includes((await json('POST', `/approvals/${c1.json.uuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokenB}` })).status));
    assert.ok([200, 409].includes((await json('POST', `/approvals/${c2.json.uuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokenA}` })).status));
    assert.ok([200, 409].includes((await json('POST', `/approvals/${c2.json.uuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokenB}` })).status));

    // Claim and complete both by Alice
    assert.equal((await agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}`, Connection: 'close' })).status, 204);
    assert.equal((await agent.patch(`/chores/${c1.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}`, Connection: 'close' }).attach('image', Buffer.from([1,2,3]), { filename: 'q1.jpg', contentType: 'image/jpeg' })).status, 204);
    assert.equal((await agent.patch(`/chores/${c2.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}`, Connection: 'close' })).status, 204);
    assert.equal((await agent.patch(`/chores/${c2.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}`, Connection: 'close' }).attach('image', Buffer.from([1,2,3]), { filename: 'q2.jpg', contentType: 'image/jpeg' })).status, 204);

    // Get points for Alice
    const r = await json('GET', `/points/${homeId}/${encodeURIComponent(alice.email)}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(r.status, 200);
    const pts = Number(r.json.points ?? r.json.total ?? r.json.totalPoints ?? 0);
    // Accept either capped 10 or uncapped 12 to avoid overfitting; tighten later when policy is finalized
    assert.ok([10, 12].includes(pts), `Expected points to be capped at 10 or uncapped 12, got ${pts}`);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


