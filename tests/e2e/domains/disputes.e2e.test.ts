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
  const h = headers || {};
  switch (method.toUpperCase()) {
    case 'GET': r = r.get(url); break;
    case 'POST': r = r.post(url).send(body ?? {}); break;
    case 'PATCH': r = r.patch(url).send(body ?? {}); break;
    case 'DELETE': r = r.delete(url).send(body ?? {}); break;
    default: throw new Error(`unsupported method ${method}`);
  }
  if (Object.keys(h).length > 0) r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try { return { status: res.status, json: JSON.parse(text) } as any; }
  catch { return { status: res.status, json: text } as any; }
}

describe('Disputes domain E2E', () => {
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
    // Create and complete a chore by Alice to be disputed by Bob
    const create = await json('POST', '/chores', { name: 'D Chore', description: 'for disputes', time: '2036-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 1 }, { Authorization: `Bearer ${tokens[alice.email]}` });
    assert.equal(create.status, 201);
    choreUuid = create.json.uuid;
    // Approve and complete chore by Alice (ensure threshold met)
    assert.ok([200, 409].includes((await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokens[alice.email]}` })).status));
    assert.ok([200, 409].includes((await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokens[bob.email]}` })).status));
    const claim = await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${tokens[alice.email]}` });
    assert.equal(claim.status, 204);
    const complete = await agent.patch(`/chores/${choreUuid}/complete`).set({ Authorization: `Bearer ${tokens[alice.email]}` }).attach('image', Buffer.from([1,2,3]), { filename: 'd.jpg', contentType: 'image/jpeg' });
    assert.equal(complete.status, 204);
  }, 30000);

  it('create dispute, list by home, get by id, sustain and overrule via endpoints', async () => {
    // Create dispute by Bob
    const created = await json('POST', '/disputes', { choreId: choreUuid, reason: 'not good' }, { Authorization: `Bearer ${tokens[bob.email]}` });
    assert.equal(created.status, 201);
    disputeUuid = created.json.uuid;

    // Get by id (guarantee persistence deterministically)
    const byId = await json('GET', `/disputes/${disputeUuid}`, undefined, { Authorization: `Bearer ${tokens[bob.email]}` });
    assert.equal(byId.status, 200);
    assert.equal(byId.json.uuid, disputeUuid);

    // Then list once and ensure it appears
    const list = await json('GET', `/disputes?homeId=${encodeURIComponent(homeId)}&status=pending`, undefined, { Authorization: `Bearer ${tokens[bob.email]}` });
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.json));
    assert.ok(list.json.some((d: any) => d.uuid === disputeUuid));

    // Sustain then overrule via admin endpoints (just exercise endpoints)
    const s = await json('PATCH', `/disputes/${disputeUuid}/sustain`, {}, { Authorization: `Bearer ${tokens[bob.email]}` });
    assert.equal(s.status, 204);
    const o = await json('PATCH', `/disputes/${disputeUuid}/overrule`, {}, { Authorization: `Bearer ${tokens[bob.email]}` });
    assert.equal(o.status, 204);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


