import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

describe('Multi-home isolation and identity spoofing', () => {
  const alice = { email: 'a@example.com', password: 'password123', name: 'Alice' };
  const bob   = { email: 'b@example.com', password: 'password123', name: 'Bob' };
  let tA = '', tB = '', homeId = '', choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails([alice.email, bob.email]);
    tA = await supabaseSignupOrLogin(alice.email, alice.password);
    tB = await supabaseSignupOrLogin(bob.email, bob.password);
    const h = await json('POST','/homes',{ name: 'Isolation Home' });
    assert.equal(h.status, 201); homeId = h.json.id;
    await createOrJoinUser(agent as any, alice.email, alice.name, homeId);
    await createOrJoinUser(agent as any, bob.email, bob.name, homeId);
    const c = await json('POST','/chores', { name:'Isolation', time:new Date().toISOString(), points:1, home_id:homeId }, { Authorization:`Bearer ${tA}`});
    assert.equal(c.status, 201); choreUuid = c.json.uuid;
  });
  afterAll(cleanupTestData);

  it('ignores spoofed userEmail; actor is token user', async () => {
    // Create dispute
    const d = await json('POST','/disputes', { choreId: choreUuid, reason: 'test dispute' }, { Authorization:`Bearer ${tA}`});
    assert.equal(d.status, 201);
    const disputeUuid = d.json.uuid;

    // Try to vote while spoofing someone else in the body
    const vote = await json('POST', `/dispute-votes/${disputeUuid}/vote`, { sustain: true, userEmail: 'spoof@evil.com' }, { Authorization:`Bearer ${tA}`});
    assert.ok([200, 204].includes(vote.status));

    // Fetch vote status and assert the recorded voter is Alice (token user)
    const status = await json('GET', `/dispute-votes/${disputeUuid}/status`, null, { Authorization:`Bearer ${tA}`});
    assert.equal(status.status, 200);
    const voters = status.json?.voters || [];
    assert.ok(voters.some((v:any) => v.email === alice.email));
    assert.ok(!voters.some((v:any) => v.email === 'spoof@evil.com'));
  });
});
