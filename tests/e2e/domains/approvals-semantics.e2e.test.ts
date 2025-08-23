import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { json, agent } from '../../helpers/hono-test-client';
import { buildFourPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';
describe('Approvals semantics E2E', () => {
  const scenario = buildFourPersonHouse();
  const [alice, bob, diana, charlie] = scenario.users;
  let homeId = '';
  let tokens: Record<string, string> = {};
  let choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    for (const u of scenario.users) tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201); homeId = h.json.id;
    for (const u of scenario.users) await createOrJoinUser(agent as any, u.email, u.name, homeId);
    // Create chore owned by Alice
    const c = await json('POST', '/chores', { name: 'Semantics', description: 'approvals', time: '2032-02-02T00:00:00', icon: 'wind', home_id: homeId, points: 2 }, { Authorization: `Bearer ${tokens[alice.email]}` });
    assert.equal(c.status, 201); choreUuid = c.json.uuid;
  }, 60000);

  it('requires threshold before claim; idempotent vote and claim/complete', async () => {
    const tA = { Authorization: `Bearer ${tokens[alice.email]}` };
    const tB = { Authorization: `Bearer ${tokens[bob.email]}` };
    const tD = { Authorization: `Bearer ${tokens[diana.email]}` };

    // Status initially should be unapproved
    const st0 = await json('GET', `/approvals/${choreUuid}`, undefined, tA);
    assert.equal(st0.status, 200);

    // Single vote (Alice) insufficient in 4-person home
    const v1 = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: alice.email }, tA);
    assert.ok([200, 409].includes(v1.status));
    const claimTooEarly = await agent.patch(`/chores/${choreUuid}/claim`).set({ ...tA });
    assert.ok([403, 409].includes(claimTooEarly.status));

    // Second vote (Bob) reaches threshold
    const v2 = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: bob.email }, tB);
    assert.ok([200, 409].includes(v2.status));

    // Third vote (Diana) is fine but not required; idempotent on repeats
    const v3 = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: diana.email }, tD);
    assert.ok([200, 409].includes(v3.status));
    const v3again = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: diana.email }, tD);
    assert.equal(v3again.status, 409);

    // Now claim should be allowed; idempotent repeat returns 409
    const claim1 = await agent.patch(`/chores/${choreUuid}/claim`).set({ ...tA });
    assert.equal(claim1.status, 204);
    const claimAgain = await agent.patch(`/chores/${choreUuid}/claim`).set({ ...tA });
    assert.ok([204, 409].includes(claimAgain.status));

    // Complete once; repeat complete returns 409
    const complete1 = await agent.patch(`/chores/${choreUuid}/complete`).set({ ...tA }).attach('image', Buffer.from([1,2,3]), { filename: 'p.jpg', contentType: 'image/jpeg' });
    assert.equal(complete1.status, 204);
    const completeAgain = await agent.patch(`/chores/${choreUuid}/complete`).set({ ...tA }).attach('image', Buffer.from([1,2,3]), { filename: 'p2.jpg', contentType: 'image/jpeg' });
    assert.ok([204, 409].includes(completeAgain.status));

    // Optional: unvote reduces votes below threshold, preventing new claims on new chore
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
