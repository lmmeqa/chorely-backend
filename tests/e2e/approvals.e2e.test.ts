import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json } from '../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from './helpers/reset-backend';
import { assertMatches, ApprovalStatusSchema } from './helpers/contracts';
import { buildTwoPersonHouse } from './helpers/test-scenarios';
import { expectApprovalVotePayload } from './helpers/assertions';

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
    const h = await json('POST', '/homes', { name: scenario.homeName }, { Authorization: `Bearer ${token1}` });
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
    assert.equal(v1.status, 200);
    expectApprovalVotePayload(v1.json);

    // vote second (user2) to reach threshold for multi-user homes
    const v2 = await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: user2 }, { Authorization: `Bearer ${token2}` });
    assert.equal(v2.status, 200);
    expectApprovalVotePayload(v2.json);

    // status should be unclaimed now or remain approved
    const st1 = await json('GET', `/approvals/${choreUuid}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(st1.status, 200);
    assertMatches(ApprovalStatusSchema, st1.json, 'GET /approvals/:uuid');
    assert.ok(st1.json.votes >= st1.json.required);

    // unvote by user2 should potentially drop below threshold
    const un = await json('DELETE', `/approvals/${choreUuid}/vote`, undefined, { Authorization: `Bearer ${token2}` });
    assert.equal(un.status, 204);
    // Check status again
    const st2 = await json('GET', `/approvals/${choreUuid}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(st2.status, 200);
    assertMatches(ApprovalStatusSchema, st2.json, 'GET /approvals/:uuid');
    assert.ok(st2.json.votes <= st1.json.votes);
  });

  it('duplicate voting returns 409', async () => {
    // Create a new chore for duplicate vote test
    const create = await json('POST', '/chores', {
      name: 'Duplicate Vote Test', 
      description: 'Test duplicate voting', 
      time: '2031-01-01T00:00:00', 
      icon: 'repeat', 
      home_id: homeId, 
      points: 3,
    }, { Authorization: `Bearer ${token1}` });
    assert.equal(create.status, 201);
    const testChoreUuid = create.json.uuid;

    // First vote should succeed
    const firstVote = await json('POST', `/approvals/${testChoreUuid}/vote`, { userEmail: user1 }, { Authorization: `Bearer ${token1}` });
    assert.equal(firstVote.status, 200);
    expectApprovalVotePayload(firstVote.json);

    // Duplicate vote should return 409
    const duplicateVote = await json('POST', `/approvals/${testChoreUuid}/vote`, { userEmail: user1 }, { Authorization: `Bearer ${token1}` });
    assert.equal(duplicateVote.status, 409);
  });

  it('unvote test returns 204', async () => {
    // Create a new chore for unvote test
    const create = await json('POST', '/chores', {
      name: 'Unvote Test', 
      description: 'Test unvote functionality', 
      time: '2031-01-01T00:00:00', 
      icon: 'undo', 
      home_id: homeId, 
      points: 2,
    }, { Authorization: `Bearer ${token1}` });
    assert.equal(create.status, 201);
    const testChoreUuid = create.json.uuid;

    // Vote first
    const vote = await json('POST', `/approvals/${testChoreUuid}/vote`, { userEmail: user1 }, { Authorization: `Bearer ${token1}` });
    assert.equal(vote.status, 200);
    expectApprovalVotePayload(vote.json);

    // Unvote should return 204
    const unvote = await json('DELETE', `/approvals/${testChoreUuid}/vote`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(unvote.status, 204);
  });

  it('voting is only allowed on unapproved chores', async () => {
    // Create a new chore for this specific test
    const create = await json('POST', '/chores', {
      name: 'Vote Restriction Test', 
      description: 'Test vote restrictions by status', 
      time: '2031-01-01T00:00:00', 
      icon: 'lock', 
      home_id: homeId, 
      points: 5,
    }, { Authorization: `Bearer ${token1}` });
    assert.equal(create.status, 201);
    const testChoreUuid = create.json.uuid;

    // Verify chore starts as unapproved
    const getInitialChore = await json('GET', `/chores/${testChoreUuid}`, undefined, { Authorization: `Bearer ${token1}` });
    assert.equal(getInitialChore.status, 200);
    assert.equal(getInitialChore.json.status, 'unapproved');

    // Voting should work on unapproved chore
    const voteOnUnapproved = await json('POST', `/approvals/${testChoreUuid}/vote`, { userEmail: user1 }, { Authorization: `Bearer ${token1}` });
    assert.equal(voteOnUnapproved.status, 200);
    expectApprovalVotePayload(voteOnUnapproved.json);

    // Approve the chore (from unapproved to unclaimed)
    const approve = await json('PATCH', `/chores/${testChoreUuid}/approve`, {}, { Authorization: `Bearer ${token1}` });
    assert.equal(approve.status, 204);

    // Voting should be rejected on unclaimed chore
    const voteOnUnclaimed = await json('POST', `/approvals/${testChoreUuid}/vote`, { userEmail: user2 }, { Authorization: `Bearer ${token2}` });
    assert.equal(voteOnUnclaimed.status, 409, 'Should not allow voting on unclaimed chore');
    assert.ok(voteOnUnclaimed.json.error.includes('unapproved'), 'Error should mention chore must be unapproved');

    // Claim the chore
    const claim = await json('PATCH', `/chores/${testChoreUuid}/claim`, {}, { Authorization: `Bearer ${token1}` });
    assert.equal(claim.status, 204);

    // Voting should be rejected on claimed chore
    const voteOnClaimed = await json('POST', `/approvals/${testChoreUuid}/vote`, { userEmail: user2 }, { Authorization: `Bearer ${token2}` });
    assert.equal(voteOnClaimed.status, 409, 'Should not allow voting on claimed chore');
    assert.ok(voteOnClaimed.json.error.includes('unapproved'), 'Error should mention chore must be unapproved');

    // Complete the chore
    const complete = await json('PATCH', `/chores/${testChoreUuid}/complete`, {}, { Authorization: `Bearer ${token1}` });
    assert.equal(complete.status, 204);

    // Voting should be rejected on completed chore - post-completion vote test
    const voteOnCompleted = await json('POST', `/approvals/${testChoreUuid}/vote`, { userEmail: user2 }, { Authorization: `Bearer ${token2}` });
    assert.equal(voteOnCompleted.status, 409, 'Should not allow voting on completed chore');
    assert.ok(voteOnCompleted.json.error.includes('unapproved'), 'Error should mention chore must be unapproved');
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


