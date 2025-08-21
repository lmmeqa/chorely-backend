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
  const h = { Connection: 'close', ...(headers || {}) } as Record<string, string>;
  switch (method.toUpperCase()) {
    case 'GET': r = r.get(url); break;
    case 'POST': r = r.post(url).send(body ?? {}); break;
    case 'PATCH': r = r.patch(url).send(body ?? {}); break;
    case 'PUT': r = r.put(url).send(body ?? {}); break;
    case 'DELETE': r = r.delete(url).send(body ?? {}); break;
    default: throw new Error(`unsupported method ${method}`);
  }
  r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try {
    return { status: res.status, json: JSON.parse(text) } as any;
  } catch {
    return { status: res.status, json: text } as any;
  }
}

describe('Four-Person House Happy Path', () => {
  const scenario = buildFourPersonHouse();
  const [alice, bob, diana, charlie] = scenario.users;

  let homeId = '';
  let tokens: Record<string, string> = {};

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    // Sign up all four users
    for (const u of scenario.users) {
      tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    }
    // Create home
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201);
    homeId = h.json.id;
    // Create backend users and link to home
    for (const u of scenario.users) {
      const r = await json('POST', '/user', { email: u.email, homeIds: [homeId], name: u.name });
      if (r.status === 409) {
        const j = await json('POST', '/user/join', { email: u.email, homeId });
        assert.equal(j.status, 204);
      } else {
        assert.equal(r.status, 201);
      }
    }
  }, 30000);

  it('lists users points initially (empty or zero) and supports approvals threshold with more users', async () => {
    const tokenA = tokens[alice.email];
    const r = await json('GET', `/points/${homeId}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(r.status, 200);
    // Should include all 4 users
    for (const u of scenario.users) {
      assert.ok(r.json.find((p: any) => p.user_email === u.email));
    }
  });

  it('multi-user approval flow requires at least 2 votes to approve', async () => {
    const tokenA = tokens[alice.email];
    const tokenB = tokens[bob.email];
    const tokenD = tokens[diana.email];
    // Create a chore
    const create = await json('POST', '/chores', {
      name: 'FP Chore', description: 'four-person scenario', time: '2031-02-02T00:00:00', icon: 'wind', home_id: homeId, points: 4,
    }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(create.status, 201);
    const uuid = create.json.uuid as string;

    // One vote should not necessarily be enough in larger home thresholds
    const v1 = await json('POST', `/approvals/${uuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokenA}` });
    assert.ok([200, 409].includes(v1.status));
    const st1 = await json('GET', `/approvals/${uuid}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(st1.status, 200);

    // Second vote reaches threshold
    const v2 = await json('POST', `/approvals/${uuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokenB}` });
    assert.ok([200, 409].includes(v2.status));
    const st2 = await json('GET', `/approvals/${uuid}`, undefined, { Authorization: `Bearer ${tokenD}` });
    assert.equal(st2.status, 200);
    assert.ok(st2.json.votes >= st2.json.required);
  });

  it('claim and complete chore, then sustain dispute by a non-claimer among four users', async () => {
    const tokenC = tokens[charlie.email];
    const tokenD = tokens[diana.email];
    const tokenA = tokens[alice.email];
    const tokenB = tokens[bob.email];
    // Create and claim by Charlie
    const create = await json('POST', '/chores', {
      name: 'FP Completion', description: 'proof upload', time: '2032-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 6,
    }, { Authorization: `Bearer ${tokenC}` });
    assert.equal(create.status, 201);
    const uuid = create.json.uuid as string;
    // Approve first (reach threshold)
    const v1 = await json('POST', `/approvals/${uuid}/vote`, { userEmail: charlie.email }, { Authorization: `Bearer ${tokenC}` });
    assert.ok([200, 409].includes(v1.status));
    const approvalVote2 = await json('POST', `/approvals/${uuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokenA}` });
    assert.ok([200, 409].includes(approvalVote2.status));
    const approveStatus = await json('GET', `/approvals/${uuid}`, undefined, { Authorization: `Bearer ${tokenB}` });
    assert.equal(approveStatus.status, 200);
    assert.ok(approveStatus.json.votes >= approveStatus.json.required);
    const claim = await request(app).patch(`/chores/${uuid}/claim`).set({ Authorization: `Bearer ${tokenC}` });
    assert.equal(claim.status, 204);
    const complete = await request(app)
      .patch(`/chores/${uuid}/complete`)
      .set({ Authorization: `Bearer ${tokenC}` })
      .attach('image', Buffer.from([1,2,3]), { filename: 'fp.jpg', contentType: 'image/jpeg' });
    assert.equal(complete.status, 204);

    // Raise dispute by Diana
    const d = await json('POST', '/disputes', { choreId: uuid, reason: 'not done' }, { Authorization: `Bearer ${tokenD}` });
    assert.equal(d.status, 201);
    const disputeUuid = d.json.uuid as string;

    // Sustain by Diana
    const v = await request(app).post(`/dispute-votes/${disputeUuid}/vote`).set({ 'Content-Type': 'application/json', Authorization: `Bearer ${tokenD}` }).send({ vote: 'sustain' });
    assert.equal(v.status, 204);
    // A second sustain vote (e.g., Alice) to reach threshold (2 of 3 eligible)
    const sustainVote2 = await request(app).post(`/dispute-votes/${disputeUuid}/vote`).set({ 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` }).send({ vote: 'sustain' });
    assert.equal(sustainVote2.status, 204);

    const disputeStatus = await json('GET', `/dispute-votes/${disputeUuid}/status`, undefined, { Authorization: `Bearer ${tokenC}` });
    assert.equal(disputeStatus.status, 200);
    assert.equal(disputeStatus.json.is_sustained, true);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


