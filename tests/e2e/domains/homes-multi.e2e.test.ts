import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { json, agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';
describe('Multi-home isolation E2E', () => {
  const email1 = 'mh.alice@e2e.local';
  const email2 = 'mh.bob@e2e.local';
  const pw = 'Password1!';
  let token1 = '';
  let token2 = '';
  let homeA = '';
  let homeB = '';
  let choreAUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails([email1, email2]);
    token1 = await supabaseSignupOrLogin(email1, pw);
    token2 = await supabaseSignupOrLogin(email2, pw);

    // Create two homes
    const a = await json('POST', '/homes', { name: `Multi-Home A ${Date.now()}` });
    assert.equal(a.status, 201); homeA = a.json.id;
    const b = await json('POST', '/homes', { name: `Multi-Home B ${Date.now()}` });
    assert.equal(b.status, 201); homeB = b.json.id;

    // User1 joins both homes
    await createOrJoinUser(agent as any, email1, 'MH Alice', homeA);
    await createOrJoinUser(agent as any, email1, 'MH Alice', homeB);
    // User2 joins only homeB
    await createOrJoinUser(agent as any, email2, 'MH Bob', homeB);

    // Create a chore in Home A by user1
    const c = await json('POST', '/chores', {
      name: 'A-only Chore', description: 'scoping', time: '2034-01-01T00:00:00', icon: 'wind', home_id: homeA, points: 1,
    }, { Authorization: `Bearer ${token1}` });
    assert.equal(c.status, 201);
    choreAUuid = c.json.uuid;
  }, 30000);

  it('lists are scoped per home', async () => {
    // Unapproved list in Home A includes the chore
    const ua = await json('GET', `/chores/unapproved/${homeA}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(ua.status, 200);
    assert.ok(Array.isArray(ua.json));
    assert.ok(ua.json.some((ch: any) => ch.uuid === choreAUuid));

    // Unapproved list in Home B does NOT include Home A chore
    const ub = await json('GET', `/chores/unapproved/${homeB}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(ub.status, 200);
    assert.ok(Array.isArray(ub.json));
    assert.ok(!ub.json.some((ch: any) => ch.uuid === choreAUuid));
  });

  it('blocks cross-home access by non-members', async () => {
    // User2 is not in Home A → should not access unapproved list of Home A
    const r1 = await json('GET', `/chores/unapproved/${homeA}`, undefined, { Authorization: `Bearer ${token2}` });
    assert.ok([401, 403].includes(r1.status));

    // User2 should also be blocked from voting on Home A chore
    const vote = await json('POST', `/approvals/${choreAUuid}/vote`, { userEmail: email2 }, { Authorization: `Bearer ${token2}` });
    assert.ok([401, 403].includes(vote.status));

    // And points listing for Home A
    const pts = await json('GET', `/points/${homeA}`, undefined, { Authorization: `Bearer ${token2}` });
    assert.ok([401, 403].includes(pts.status));
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
