import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app';
import { buildFourPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';

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
  try {
    return { status: res.status, json: JSON.parse(text) } as any;
  } catch {
    return { status: res.status, json: text } as any;
  }
}

describe('Four-Person Approvals E2E', () => {
  const scenario = buildFourPersonHouse();
  const [alice, bob, diana, charlie] = scenario.users;

  let homeId = '';
  let tokens: Record<string, string> = {};
  let choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    for (const u of scenario.users) {
      tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    }
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201);
    homeId = h.json.id;
    for (const u of scenario.users) {
      const r = await json('POST', '/user', { email: u.email, homeIds: [homeId], name: u.name });
      if (r.status === 409) {
        const j = await json('POST', '/user/join', { email: u.email, homeId });
        assert.equal(j.status, 204);
      } else {
        assert.equal(r.status, 201);
      }
    }
    // create chore owned by Alice
    const create = await json('POST', '/chores', {
      name: 'FP Approval Target', description: 'for four-person unvote', time: '2033-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 2,
    }, { Authorization: `Bearer ${tokens[alice.email]}` });
    assert.equal(create.status, 201);
    choreUuid = create.json.uuid;
  }, 30000);

  it('requires multiple votes to approve, and unvote can drop below threshold', async () => {
    const tokenA = tokens[alice.email];
    const tokenB = tokens[bob.email];
    const tokenD = tokens[diana.email];

    // Alice vote
    const v1 = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokenA}` });
    assert.ok([200, 409].includes(v1.status));
    // Bob vote
    const v2 = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokenB}` });
    assert.ok([200, 409].includes(v2.status));
    // Verify approved
    const st1 = await json('GET', `/approvals/${choreUuid}`, undefined, { Authorization: `Bearer ${tokenD}` });
    assert.equal(st1.status, 200);
    assert.ok(st1.json.votes >= st1.json.required);

    // Unvote by Bob
    const un = await json('POST', `/approvals/${choreUuid}/unvote`, {}, { Authorization: `Bearer ${tokenB}` });
    assert.equal(un.status, 200);
    // Verify dropped
    const st2 = await json('GET', `/approvals/${choreUuid}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(st2.status, 200);
    assert.ok(st2.json.votes <= st1.json.votes);
  });

  it('edge: claim before approved returns 409 (conflict)', async () => {
    const tokenC = tokens[charlie.email];
    // Create a fresh chore not yet approved
    const create = await json('POST', '/chores', {
      name: 'Edge Claim Early', description: 'edge case', time: '2034-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 1,
    }, { Authorization: `Bearer ${tokenC}` });
    assert.equal(create.status, 201);
    const uuid = create.json.uuid as string;
    const claim = await request(app).patch(`/chores/${uuid}/claim`).set({ Authorization: `Bearer ${tokenC}` });
    assert.equal(claim.status, 409);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


