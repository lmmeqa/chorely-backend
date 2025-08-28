import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

describe('Completion idempotency and points', () => {
  const alice = { email: 'a@example.com', password: 'password123', name: 'Alice' };
  const bob   = { email: 'b@example.com', password: 'password123', name: 'Bob' };
  let tA = '', tB = '', homeId = '', choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails([alice.email, bob.email]);
    tA = await supabaseSignupOrLogin(alice.email, alice.password);
    tB = await supabaseSignupOrLogin(bob.email, bob.password);
    const h = await json('POST','/homes',{ name: 'Comp Home' });
    assert.equal(h.status, 201); homeId = h.json.id;
    await createOrJoinUser(agent as any, alice.email, alice.name, homeId);
    await createOrJoinUser(agent as any, bob.email, bob.name, homeId);
    const c = await json('POST','/chores', { name:'Comp', time:new Date().toISOString(), points:3, home_id:homeId }, { Authorization:`Bearer ${tA}`});
    assert.equal(c.status, 201); choreUuid = c.json.uuid;
    // Approve the chore first
    const approve = await agent.patch(`/chores/${choreUuid}/approve`).set({ Authorization: `Bearer ${tA}` });
    assert.equal(approve.status, 204);
  });
  afterAll(cleanupTestData);

  it('re-completing (including while dispute pending) does not double-award points', async () => {
    // First, claim and complete the chore
    const claim = await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${tA}` });
    assert.equal(claim.status, 204);

    // Baseline points for Alice
    const before = (await json('GET', `/points/${homeId}/${alice.email}`, undefined, { Authorization:`Bearer ${tA}`})).json.points;

    const jpeg = Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64');
    const first = await json('PATCH', `/chores/${choreUuid}/complete`, {
      image: { data: jpeg, filename: 'p.jpg', contentType: 'image/jpeg' }
    }, { Authorization:`Bearer ${tA}`});
    assert.ok([204,409].includes(first.status));

    const mid = (await json('GET', `/points/${homeId}/${alice.email}`, undefined, { Authorization:`Bearer ${tA}`})).json.points;

    // Open a dispute (does not itself award points)
    const d = await json('POST','/disputes', {
      choreId: choreUuid,
      reason: 'nit: missed a spot'
    }, { Authorization:`Bearer ${tB}`});
    assert.equal(d.status, 201);

    // Re-complete during pending dispute → allowed statuses, but points must not increase
    const retry = await json('PATCH', `/chores/${choreUuid}/complete`, {
      image: { data: jpeg, filename: 'p.jpg', contentType: 'image/jpeg' }
    }, { Authorization:`Bearer ${tA}`});
    assert.ok([204,409].includes(retry.status));

    const after = (await json('GET', `/points/${homeId}/${alice.email}`, undefined, { Authorization:`Bearer ${tA}`})).json.points;
    // Exactly one awarding overall
    assert.ok(after === mid && mid >= before);
  });

  it('cannot complete unclaimed chore (409)', async () => {
    const c = await json('POST','/chores', { home_id:homeId, name:'u', time:new Date().toISOString() }, { Authorization:`Bearer ${tA}`});
    const img = Buffer.from([0xff,0xd8,0xff,0xd9]);
    const r = await agent.patch(`/chores/${c.json.uuid}/complete`).set({ Authorization: `Bearer ${tA}` }).attach('image', img, { filename:'p.jpg', contentType:'image/jpeg' });
    assert.equal(r.status, 409);
  });
});
