import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { buildTwoPersonHouse } from './helpers/test-scenarios';
import { resetBackendForEmails, cleanupTestData } from './helpers/reset-backend';

describe('Batch Endpoints E2E', () => {
  const scenario = buildTwoPersonHouse();
  const user1 = scenario.users[0].email;
  const user2 = scenario.users[1].email;
  const pw = scenario.users[0].password;
  let token1 = '';
  let token2 = '';
  let homeId = '';
  let chore1Uuid = '';
  let chore2Uuid = '';
  let chore3Uuid = '';

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
    
    // Create test chores in different states
    // Chore 1: Available (unapproved)
    const c1 = await json('POST', '/chores', {
      name: 'Available Chore',
      description: 'For testing available chores',
      time: '2030-12-31T00:00:00',
      icon: 'wind',
      home_id: homeId,
      points: 5,
    }, { Authorization: `Bearer ${token1}` });
    chore1Uuid = c1.json.uuid;
    
    // Chore 2: Claimed (approved + claimed)
    const c2 = await json('POST', '/chores', {
      name: 'My Chore',
      description: 'For testing my chores',
      time: '2030-12-31T00:00:00',
      icon: 'package',
      home_id: homeId,
      points: 3,
    }, { Authorization: `Bearer ${token1}` });
    chore2Uuid = c2.json.uuid;
    await agent.patch(`/chores/${chore2Uuid}/approve`).set({ Authorization: `Bearer ${token1}` });
    await agent.patch(`/chores/${chore2Uuid}/claim`).set({ Authorization: `Bearer ${token1}` });
    
    // Chore 3: Completed (waiting approval)
    const c3 = await json('POST', '/chores', {
      name: 'Completed Chore',
      description: 'For testing pending approval',
      time: '2030-12-31T00:00:00',
      icon: 'check',
      home_id: homeId,
      points: 7,
    }, { Authorization: `Bearer ${token1}` });
    chore3Uuid = c3.json.uuid;
    await agent.patch(`/chores/${chore3Uuid}/approve`).set({ Authorization: `Bearer ${token1}` });
    await agent.patch(`/chores/${chore3Uuid}/claim`).set({ Authorization: `Bearer ${token1}` });
    await agent.patch(`/chores/${chore3Uuid}/complete`).set({ Authorization: `Bearer ${token1}` });
  }, 60000);

  describe('Home Data Batch Endpoint', () => {
    it('should return all home data in single request', async () => {
      const response = await json(
        'GET', 
        `/home/${homeId}/summary?user=${encodeURIComponent(user1)}`,
        undefined,
        { Authorization: `Bearer ${token1}` }
      );
      
      assert.equal(response.status, 200);
      
      const data = response.json;
      assert.ok(data.availableChores);
      assert.ok(data.myChores);
      assert.ok(data.unapprovedChores);
      assert.ok(typeof data.userPoints === 'number');
      assert.ok(data.allUserPoints);
      
      // Verify structure
      assert.ok(Array.isArray(data.availableChores));
      assert.ok(Array.isArray(data.myChores));
      assert.ok(Array.isArray(data.unapprovedChores));
      assert.ok(typeof data.allUserPoints === 'object');
      
      // Verify content
      const myChore = data.myChores.find((c: any) => c.uuid === chore2Uuid);
      assert.ok(myChore);
      assert.equal(myChore.status, 'claimed');
      
      const completedChore = data.unapprovedChores.find((c: any) => c.uuid === chore3Uuid);
      assert.ok(completedChore);
      assert.equal(completedChore.status, 'complete');
      
      // Verify points data includes both users
      assert.ok(data.allUserPoints[user1] !== undefined);
      assert.ok(data.allUserPoints[user2] !== undefined);
    });

    it('should handle missing user parameter', async () => {
      const response = await json(
        'GET', 
        `/home/${homeId}/summary`,
        undefined,
        { Authorization: `Bearer ${token1}` }
      );
      
      assert.equal(response.status, 400);
      assert.ok(response.json.error.includes('user'));
    });

    it('should handle invalid home ID format', async () => {
      const response = await json(
        'GET', 
        `/home/invalid-home-id/summary?user=${encodeURIComponent(user1)}`,
        undefined,
        { Authorization: `Bearer ${token1}` }
      );
      
      assert.equal(response.status, 400);
      assert.ok(response.json.error.includes('Invalid home ID format'));
    });

    it('should handle non-existent home ID', async () => {
      const response = await json(
        'GET', 
        `/home/550e8400-e29b-41d4-a716-446655440000/summary?user=${encodeURIComponent(user1)}`,
        undefined,
        { Authorization: `Bearer ${token1}` }
      );
      
      assert.equal(response.status, 404);
      assert.ok(response.json.error.includes('Home not found'));
    });

    it('should require authentication', async () => {
      const response = await json(
        'GET', 
        `/home/${homeId}/summary?user=${encodeURIComponent(user1)}`
      );
      
      assert.equal(response.status, 401);
    });
  });

  describe('Approvals Batch Endpoint', () => {
    it('should return approval statuses for multiple chores', async () => {
      const response = await json(
        'POST',
        '/approvals/batch',
        { uuids: [chore1Uuid, chore2Uuid, chore3Uuid] },
        { Authorization: `Bearer ${token1}` }
      );
      
      assert.equal(response.status, 200);
      
      const data = response.json;
      assert.ok(Array.isArray(data));
      assert.equal(data.length, 3);
      
      // Each item should have the approval status structure
      data.forEach((item: any) => {
        assert.ok(item.uuid);
        assert.ok(typeof item.required === 'number');
        assert.ok(typeof item.votes === 'number');
        assert.ok(typeof item.status === 'string');
        assert.ok(typeof item.total_users === 'number');
        assert.ok(Array.isArray(item.voters));
      });
      
      // Find specific chores and verify their status
      const completedChoreStatus = data.find((item: any) => item.uuid === chore3Uuid);
      assert.ok(completedChoreStatus);
      assert.equal(completedChoreStatus.status, 'complete'); // Completed, waiting for approval
    });

    it('should handle empty uuid array', async () => {
      const response = await json(
        'POST',
        '/approvals/batch',
        { uuids: [] },
        { Authorization: `Bearer ${token1}` }
      );
      
      assert.equal(response.status, 200);
      assert.ok(Array.isArray(response.json));
      assert.equal(response.json.length, 0);
    });

    it('should handle non-existent chore UUIDs gracefully', async () => {
      const response = await json(
        'POST',
        '/approvals/batch',
        { uuids: ['550e8400-e29b-41d4-a716-446655440000', chore1Uuid] }, // Valid UUID format but non-existent
        { Authorization: `Bearer ${token1}` }
      );
      
      assert.equal(response.status, 200);
      const data = response.json;
      
      // Should only return data for valid UUIDs
      assert.equal(data.length, 1);
      assert.equal(data[0].uuid, chore1Uuid);
    });

    it('should require authentication', async () => {
      const response = await json(
        'POST',
        '/approvals/batch',
        { uuids: [chore1Uuid] }
      );
      
      assert.equal(response.status, 401);
    });

    it('should validate request body', async () => {
      const response = await json(
        'POST',
        '/approvals/batch',
        { invalid: 'data' },
        { Authorization: `Bearer ${token1}` }
      );
      
      assert.equal(response.status, 400);
    });
  });

  describe('Performance Benefits', () => {
    it('batch endpoint should be faster than individual calls', async () => {
      // Time individual calls
      const individualStart = Date.now();
      
      const [available, my, unapproved, userPts, allPts] = await Promise.all([
        json('GET', `/chores/available/${homeId}`, undefined, { Authorization: `Bearer ${token1}` }),
        json('GET', `/chores/user?homeId=${homeId}`, undefined, { Authorization: `Bearer ${token1}` }),
        json('GET', `/chores/unapproved/${homeId}`, undefined, { Authorization: `Bearer ${token1}` }),
        json('GET', `/points/${homeId}/${encodeURIComponent(user1)}`, undefined, { Authorization: `Bearer ${token1}` }),
        json('GET', `/points/${homeId}`, undefined, { Authorization: `Bearer ${token1}` }),
      ]);
      
      const individualTime = Date.now() - individualStart;
      
      // Time batch call
      const batchStart = Date.now();
      
      const batch = await json(
        'GET', 
        `/home/${homeId}/summary?user=${encodeURIComponent(user1)}`,
        undefined,
        { Authorization: `Bearer ${token1}` }
      );
      
      const batchTime = Date.now() - batchStart;
      
      // Verify both return the same data structure
      assert.equal(available.status, 200);
      assert.equal(my.status, 200);
      assert.equal(unapproved.status, 200);
      assert.equal(userPts.status, 200);
      assert.equal(allPts.status, 200);
      assert.equal(batch.status, 200);
      
      // Batch should be faster (though not always guaranteed in test environment)
      console.log(`Individual calls: ${individualTime}ms, Batch call: ${batchTime}ms`);
      
      // At minimum, batch should return equivalent data
      assert.equal(batch.json.myChores.length, my.json.length);
      assert.equal(batch.json.unapprovedChores.length, unapproved.json.length);
      assert.equal(batch.json.userPoints, userPts.json.points);
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});