import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json } from '../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from './helpers/reset-backend';
import { assertMatches, ApprovalStatusSchema } from './helpers/contracts';
import { buildTwoPersonHouse } from './helpers/test-scenarios';

// Tests rely on tests/.env via tests/config/env.ts

describe('Approvals E2E', () => {
  const scenario = buildTwoPersonHouse();
  const user1 = scenario.users[0].email;
  const user2 = scenario.users[1].email;
  const pw = scenario.users[0].password;
  let token1 = '';
  let token2 = '';
  let homeId = '';
  let choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails([user1, user2]);
    token1 = await supabaseSignupOrLogin(user1, pw);
    token2 = await supabaseSignupOrLogin(user2, pw);
    // Create home and users
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201);
    homeId = h.json.id;
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
    // Create chore
    const create = await json('POST', '/chores', {
      name: 'Approval Target', description: 'for unvote', time: '2031-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 1,
    }, { Authorization: `Bearer ${token1}` });
    assert.equal(create.status, 201);
    choreUuid = create.json.uuid;
  }, 30000);

  it('unvote moves approval backward when threshold drops', async () => {
    // vote once (user1)
    const v1 = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: user1 }, { Authorization: `Bearer ${token1}` });
    assert.ok([200, 409].includes(v1.status));

    // vote second (user2) to reach threshold for multi-user homes
    const v2 = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: user2 }, { Authorization: `Bearer ${token2}` });
    assert.ok([200, 409].includes(v2.status));

    // status should be unclaimed now or remain approved
    const st1 = await json('GET', `/approvals/${choreUuid}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(st1.status, 200);
    assertMatches(ApprovalStatusSchema, st1.json, 'GET /approvals/:uuid');
    assert.ok(st1.json.votes >= st1.json.required);

    // unvote by user2 should potentially drop below threshold
    const un = await json('POST', `/approvals/${choreUuid}/unvote`, {}, { Authorization: `Bearer ${token2}` });
    assert.equal(un.status, 200);
    // Check status again
    const st2 = await json('GET', `/approvals/${choreUuid}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(st2.status, 200);
    assertMatches(ApprovalStatusSchema, st2.json, 'GET /approvals/:uuid');
    assert.ok(st2.json.votes <= st1.json.votes);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


