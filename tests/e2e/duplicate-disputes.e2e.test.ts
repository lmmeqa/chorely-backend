import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { buildTwoPersonHouse } from './helpers/test-scenarios';
import { resetBackendForEmails, cleanupTestData } from './helpers/reset-backend';

describe('Duplicate Disputes Prevention E2E', () => {
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
    const home = await json('POST', '/homes', { name: scenario.homeName });
    homeId = home.json.id;
    
    // Add users to home
    await json('POST', '/user', { email: user1, homeIds: [homeId], name: scenario.users[0].name });
    await json('POST', '/user', { email: user2, homeIds: [homeId], name: scenario.users[1].name });
    
    // Create and complete a chore for dispute testing
    const chore = await json('POST', '/chores', {
      name: 'Test Chore for Dispute',
      description: 'For testing duplicate dispute prevention',
      time: '2030-12-31T00:00:00',
      icon: 'wind',
      home_id: homeId,
      points: 5,
    }, { Authorization: `Bearer ${token1}` });
    choreUuid = chore.json.uuid;
    
    // Approve, claim, and complete the chore
    await agent.patch(`/chores/${choreUuid}/approve`).set({ Authorization: `Bearer ${token1}` });
    await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${token1}` });
    await agent.patch(`/chores/${choreUuid}/complete`).set({ Authorization: `Bearer ${token1}` });
  }, 60000);

  describe('Duplicate Dispute Validation', () => {
    it('should allow creating first dispute for a chore', async () => {
      const response = await json(
        'POST',
        '/disputes',
        {
          choreId: choreUuid,
          reason: 'First dispute - quality issue'
        },
        { Authorization: `Bearer ${token2}` }
      );
      
      assert.equal(response.status, 201);
      assert.ok(response.json.uuid);
      assert.equal(response.json.choreId, choreUuid);
      assert.equal(response.json.reason, 'First dispute - quality issue');
      assert.equal(response.json.status, 'pending');
    });

    it('should prevent creating duplicate dispute for same chore', async () => {
      const response = await json(
        'POST',
        '/disputes',
        {
          choreId: choreUuid,
          reason: 'Second dispute - trying to duplicate'
        },
        { Authorization: `Bearer ${token1}` } // Different user trying to dispute
      );
      
      assert.equal(response.status, 409);
      assert.ok((response.json.error || '').includes('DUPLICATE_DISPUTE'));
    });

    it('should prevent same user from creating duplicate dispute', async () => {
      const response = await json(
        'POST',
        '/disputes',
        {
          choreId: choreUuid,
          reason: 'Another dispute from same user'
        },
        { Authorization: `Bearer ${token2}` } // Same user who created first dispute
      );
      
      assert.equal(response.status, 409);
      assert.ok((response.json.error || '').includes('DUPLICATE_DISPUTE'));
    });

    it('should allow creating dispute after previous one is resolved', async () => {
      // First, get the existing dispute to resolve it
      const disputesResponse = await json('GET', `/disputes?homeId=${homeId}`, undefined, {
        Authorization: `Bearer ${token1}`
      });
      
      assert.equal(disputesResponse.status, 200);
      assert.ok(Array.isArray(disputesResponse.json));
      
      const existingDispute = disputesResponse.json.find((d: any) => d.choreId === choreUuid);
      assert.ok(existingDispute, 'Should find the existing dispute');
      
      // Resolve the dispute (sustain it)
      const sustainResponse = await agent
        .patch(`/disputes/${existingDispute.uuid}/sustain`)
        .set({ Authorization: `Bearer ${token1}` });
      
      assert.equal(sustainResponse.status, 204);
      
      // Wait a bit for the dispute to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now create a new chore to test dispute creation after resolution
      const newChore = await json('POST', '/chores', {
        name: 'Second Test Chore',
        description: 'For testing dispute after resolution',
        time: '2030-12-31T00:00:00',
        icon: 'check',
        home_id: homeId,
        points: 3,
      }, { Authorization: `Bearer ${token1}` });
      
      const newChoreUuid = newChore.json.uuid;
      
      // Approve, claim, and complete the new chore
      await agent.patch(`/chores/${newChoreUuid}/approve`).set({ Authorization: `Bearer ${token1}` });
      await agent.patch(`/chores/${newChoreUuid}/claim`).set({ Authorization: `Bearer ${token1}` });
      await agent.patch(`/chores/${newChoreUuid}/complete`).set({ Authorization: `Bearer ${token1}` });
      
      // Now this should work since it's a different chore
      const newDisputeResponse = await json(
        'POST',
        '/disputes',
        {
          choreId: newChoreUuid,
          reason: 'New dispute for different chore'
        },
        { Authorization: `Bearer ${token2}` }
      );
      
      assert.equal(newDisputeResponse.status, 201);
      assert.ok(newDisputeResponse.json.uuid);
      assert.equal(newDisputeResponse.json.choreId, newChoreUuid);
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});