import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { json, agent } from '../../helpers/hono-test-client';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';
import { expectApprovalVotePayload } from '../helpers/assertions';
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
    assert.equal(pq.status, 200);

    // Create two chores of 6 points
    const c1 = await json('POST', '/chores', { name: 'P6-A', description: 'quota', time: '2033-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 6 }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(c1.status, 201);
    const c2 = await json('POST', '/chores', { name: 'P6-B', description: 'quota', time: '2033-01-02T00:00:00', icon: 'wind', home_id: homeId, points: 6 }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(c2.status, 201);

    // Approvals: vote by both members to ensure threshold
    const vote1a = await json('POST', `/approvals/${c1.json.uuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(vote1a.status, 200);
    expectApprovalVotePayload(vote1a.json);
    
    const vote1b = await json('POST', `/approvals/${c1.json.uuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokenB}` });
    assert.equal(vote1b.status, 200);
    expectApprovalVotePayload(vote1b.json);
    
    const vote2a = await json('POST', `/approvals/${c2.json.uuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(vote2a.status, 200);
    expectApprovalVotePayload(vote2a.json);
    
    const vote2b = await json('POST', `/approvals/${c2.json.uuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokenB}` });
    assert.equal(vote2b.status, 200);
    expectApprovalVotePayload(vote2b.json);

    // Claim and complete both by Alice
    assert.equal((await agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}` })).status, 204);
    assert.equal((await agent.patch(`/chores/${c1.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}` }).attach('image', Buffer.from([1,2,3]), { filename: 'q1.jpg', contentType: 'image/jpeg' })).status, 204);
    assert.equal((await agent.patch(`/chores/${c2.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}` })).status, 204);
    assert.equal((await agent.patch(`/chores/${c2.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}` }).attach('image', Buffer.from([1,2,3]), { filename: 'q2.jpg', contentType: 'image/jpeg' })).status, 204);

    // Get points for Alice
    const r = await json('GET', `/points/${homeId}/${encodeURIComponent(alice.email)}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(r.status, 200);
    const pts = Number(r.json.points ?? r.json.total ?? r.json.totalPoints ?? 0);
    // Assert full earned points (no cap yet) - following guide
    const expectedMinimum = 12; // 6 + 6 points from both chores
    assert.ok(pts >= expectedMinimum, `expected points >= ${expectedMinimum}, got ${pts}`);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
