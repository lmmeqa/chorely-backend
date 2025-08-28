import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json } from '../../helpers/hono-test-client';
import { agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

describe('Claim race: exactly one 204, one 409', () => {
  const alice = { email: 'a@example.com', password: 'password123', name: 'Alice' };
  const bob   = { email: 'b@example.com', password: 'password123', name: 'Bob' };
  let tA = '', tB = '', homeId = '', choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails([alice.email, bob.email]);
    tA = await supabaseSignupOrLogin(alice.email, alice.password);
    tB = await supabaseSignupOrLogin(bob.email, bob.password);
    const h = await json('POST','/homes',{ name: 'Race Home' });
    assert.equal(h.status, 201); homeId = h.json.id;
    await createOrJoinUser(agent as any, alice.email, alice.name, homeId);
    await createOrJoinUser(agent as any, bob.email, bob.name, homeId);
    const c = await json('POST','/chores', { name:'Race', time:new Date().toISOString(), points:1, home_id:homeId }, { Authorization:`Bearer ${tA}`});
    assert.equal(c.status, 201); choreUuid = c.json.uuid;
    // Approve the chore first
    const approve = await agent.patch(`/chores/${choreUuid}/approve`).set({ Authorization: `Bearer ${tA}` });
    assert.equal(approve.status, 204);
  });
  afterAll(cleanupTestData);

  it('two parallel claims → one 204, one 409', async () => {
    const [r1, r2] = await Promise.all([
      agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${tA}` }),
      agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${tB}` }),
    ]);
    const codes = [r1.status, r2.status].sort();
    assert.deepEqual(codes, [204, 409]);
  });

  it('only claimer completes; second same-user complete is a no-op (204 or 409)', async () => {
    // assume Alice won the claim
    const img = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // tiny jpeg marker bytes
    const ok1 = await agent.patch(`/chores/${choreUuid}/complete`)
      .set({ Authorization: `Bearer ${tA}` })
      .attach('image', img, { filename:'p.jpg', contentType:'image/jpeg' });
    assert.equal(ok1.status, 204);

    const notClaimer = await agent.patch(`/chores/${choreUuid}/complete`)
      .set({ Authorization: `Bearer ${tB}` })
      .attach('image', img, { filename:'p.jpg', contentType:'image/jpeg' });
    assert.equal(notClaimer.status, 409);

    const retry = await agent.patch(`/chores/${choreUuid}/complete`)
      .set({ Authorization: `Bearer ${tA}` })
      .attach('image', img, { filename:'p.jpg', contentType:'image/jpeg' });
    // Idempotent: allow either 204 (idempotent success) or 409 (already complete)
    assert.ok([204, 409].includes(retry.status));
  });

  it('activities contain ≤1 STATUS_CHANGED for claimed on this chore', async () => {
    const r = await json('GET', `/activities?homeId=${homeId}&timeFrame=1d`, undefined, { Authorization: `Bearer ${tA}` });
    assert.equal(r.status, 200);
    const rows = r.json.filter((x:any) => x.type==='STATUS_CHANGED' && x.choreUuid===choreUuid && x.newStatus==='CLAIMED');
    assert.ok(rows.length <= 1);
  });
});
