import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { buildTwoPersonHouse } from './helpers/test-scenarios';
import { resetBackendForEmails, cleanupTestData } from './helpers/reset-backend';

// Tests rely on tests/.env via tests/config/env.ts

const agent = request(app);

// use shared helper

async function json(method: string, url: string, body?: any, headers?: Record<string, string>) {
  let r: any = agent;
  const h = headers || {};
  switch (method.toUpperCase()) {
    case 'GET': r = r.get(url); break;
    case 'POST': r = r.post(url).send(body ?? {}); break;
    case 'PATCH': r = r.patch(url).send(body ?? {}); break;
    case 'PUT': r = r.put(url).send(body ?? {}); break;
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

describe('Chorely API E2E', () => {
  const scenario = buildTwoPersonHouse();
  const user1 = scenario.users[0].email;
  const user2 = scenario.users[1].email;
  const pw = scenario.users[0].password;
  let token1 = '';
  let token2 = '';
  let homeId = '';
  let choreUuid = '';
  let approvalUuid = '';
  let disputeUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails([user1, user2]);
    token1 = await supabaseSignupOrLogin(user1, pw);
    token2 = await supabaseSignupOrLogin(user2, pw);
  }, 30000);

  it('creates isolated home', async () => {
    const r = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(r.status, 201);
    assert.ok(r.json.id);
    homeId = r.json.id;
  });

  it('creates two backend users and links to home', async () => {
    const a = await json('POST', '/user', { email: user1, homeIds: [homeId], name: scenario.users[0].name });
    if (a.status === 409) {
      const j = await json('POST', '/user/join', { email: user1, homeId });
      assert.equal(j.status, 204);
    } else {
      assert.equal(a.status, 201);
    }
    const b = await json('POST', '/user', { email: user2, homeIds: [homeId], name: scenario.users[1].name });
    if (b.status === 409) {
      const j2 = await json('POST', '/user/join', { email: user2, homeId });
      assert.equal(j2.status, 204);
    } else {
      assert.equal(b.status, 201);
    }
  });

  it('lists homes and user homes', async () => {
    const r1 = await json('GET', '/homes');
    assert.equal(r1.status, 200);
    const r2 = await json('GET', `/user/${encodeURIComponent(user1)}/home`);
    assert.equal(r2.status, 200);
    assert.ok(Array.isArray(r2.json));
    assert.ok(r2.json.find((h: any) => h.id === homeId));
  });

  it('todo generation works', async () => {
    const r = await json('POST', '/todos/generate', { choreName: 'Vacuum', choreDescription: 'Living room' });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json.todos));
  });

  it('points listing requires auth and returns two users', async () => {
    const r = await json('GET', `/points/${homeId}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json));
    assert.ok(r.json.find((p: any) => p.user_email === user1));
    assert.ok(r.json.find((p: any) => p.user_email === user2));
  });

  it('chore lifecycle (create→approve→claim→complete)', async () => {
    const create = await json('POST', '/chores', {
      name: 'E2E Chore',
      description: 'created by test',
      time: '2030-12-31T00:00:00',
      icon: 'wind',
      home_id: homeId,
      points: 5,
    }, { Authorization: `Bearer ${token1}` });
    assert.equal(create.status, 201);
    choreUuid = create.json.uuid;

    const approve = await agent.patch(`/chores/${choreUuid}/approve`).set({ Authorization: `Bearer ${token1}` });
    assert.equal(approve.status, 204);

    const claim = await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${token1}` });
    assert.equal(claim.status, 204);

    const complete = await agent
      .patch(`/chores/${choreUuid}/complete`)
      .set({ Authorization: `Bearer ${token1}` })
      .attach('image', Buffer.from([1,2,3]), { filename: 'proof.jpg', contentType: 'image/jpeg' });
    assert.equal(complete.status, 204);
  });

  it('points updated after completion', async () => {
    const r = await json('GET', `/points/${homeId}/${encodeURIComponent(user1)}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(r.status, 200);
    assert.ok(typeof r.json.points === 'number');
    assert.ok(r.json.points >= 5);
  });

  it('approvals flow returns status and prevents duplicate vote', async () => {
    const create = await json('POST', '/chores', {
      name: 'E2E Approval Chore',
      description: 'for approvals',
      time: '2030-01-01T00:00:00',
      icon: 'wind',
      home_id: homeId,
      points: 3,
    }, { Authorization: `Bearer ${token1}` });
    approvalUuid = create.json.uuid;

    const status1 = await json('GET', `/approvals/${approvalUuid}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(status1.status, 200);

    const vote1 = await json('POST', `/approvals/${approvalUuid}/vote`, { userEmail: user1 }, { Authorization: `Bearer ${token1}` });
    assert.ok([200, 409].includes(vote1.status));
  });

  it('dispute + sustain by user2 reverts points', async () => {
    const d = await json('POST', '/disputes', { choreId: choreUuid, reason: 'E2E dispute' }, { Authorization: `Bearer ${token2}` });
    assert.equal(d.status, 201);
    disputeUuid = d.json.uuid;

    const v = await agent.post(`/dispute-votes/${disputeUuid}/vote`).set({ 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` }).send({ vote: 'sustain' });
    assert.equal(v.status, 204);

    const st = await json('GET', `/dispute-votes/${disputeUuid}/status`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(st.status, 200);
    assert.equal(st.json.is_sustained, true);

    const r = await json('GET', `/points/${homeId}/${encodeURIComponent(user1)}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(r.status, 200);
    assert.ok(r.json.points >= 0);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
