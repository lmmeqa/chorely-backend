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
    case 'DELETE': r = r.delete(url).send(body ?? {}); break;
    default: throw new Error(`unsupported method ${method}`);
  }
  r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try { return { status: res.status, json: JSON.parse(text) } as any; }
  catch { return { status: res.status, json: text } as any; }
}

describe('Dispute Votes E2E', () => {
  const scenario = buildTwoPersonHouse();
  const [alice, bob] = scenario.users;
  let homeId = '';
  let tokens: Record<string, string> = {};
  let choreUuid = '';
  let disputeUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    for (const u of scenario.users) tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201); homeId = h.json.id;
    for (const u of scenario.users) {
      await createOrJoinUser(agent as any, u.email, u.name, homeId);
    }
    // Create and complete a chore by Alice
    const create = await json('POST', '/chores', { name: 'DV Chore', description: 'votes', time: '2037-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 1 }, { Authorization: `Bearer ${tokens[alice.email]}` });
    assert.equal(create.status, 201); choreUuid = create.json.uuid;
    assert.ok([200, 409].includes((await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokens[alice.email]}` })).status));
    // Ensure approval threshold met before claiming
    assert.ok([200, 409].includes((await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokens[bob.email]}` })).status));
    assert.equal((await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${tokens[alice.email]}`, Connection: 'close' })).status, 204);
    assert.equal((await agent.patch(`/chores/${choreUuid}/complete`).set({ Authorization: `Bearer ${tokens[alice.email]}`, Connection: 'close' }).attach('image', Buffer.from([1,2,3]), { filename: 'dv.jpg', contentType: 'image/jpeg' })).status, 204);
    // Create dispute by Bob
    const d = await json('POST', '/disputes', { choreId: choreUuid, reason: 'dv' }, { Authorization: `Bearer ${tokens[bob.email]}` });
    assert.equal(d.status, 201); disputeUuid = d.json.uuid;
  }, 30000);

  it('vote, status, user vote, remove vote', async () => {
    const tokenB = tokens[bob.email];
    // Vote sustain
    const v = await agent.post(`/dispute-votes/${disputeUuid}/vote`).set({ 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}`, Connection: 'close' }).send({ vote: 'sustain' });
    assert.equal(v.status, 204);
    // Status reflects
    const st = await json('GET', `/dispute-votes/${disputeUuid}/status`, undefined, { Authorization: `Bearer ${tokenB}` });
    assert.equal(st.status, 200);
    // User vote returns sustain
    const uv = await json('GET', `/dispute-votes/${disputeUuid}/user/${encodeURIComponent(bob.email)}`, undefined, { Authorization: `Bearer ${tokenB}` });
    assert.equal(uv.status, 200);
    assert.equal(uv.json.vote, 'sustain');
    // Remove vote
    const del = await agent.delete(`/dispute-votes/${disputeUuid}/vote`).set({ Authorization: `Bearer ${tokenB}`, Connection: 'close' });
    assert.equal(del.status, 204);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


