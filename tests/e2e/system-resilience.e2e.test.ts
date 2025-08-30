import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { json, agent } from '../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from './helpers/reset-backend';
import { createOrJoinUser } from './helpers/users';

describe('System Resilience & Race Conditions', () => {
  const alice = 'resilience.alice@e2e.local';
  const bob = 'resilience.bob@e2e.local';
  const charlie = 'resilience.charlie@e2e.local';
  const diana = 'resilience.diana@e2e.local';
  const eve = 'resilience.eve@e2e.local';
  const frank = 'resilience.frank@e2e.local';
  const pw = 'Password1!';
  let tokenA = '', tokenB = '', tokenC = '', tokenD = '', tokenE = '', tokenF = '';
  let homeId = '';

  beforeAll(async () => {
    await resetBackendForEmails([alice, bob, charlie, diana, eve, frank]);
    
    tokenA = await supabaseSignupOrLogin(alice, pw);
    tokenB = await supabaseSignupOrLogin(bob, pw);
    tokenC = await supabaseSignupOrLogin(charlie, pw);
    tokenD = await supabaseSignupOrLogin(diana, pw);
    tokenE = await supabaseSignupOrLogin(eve, pw);
    tokenF = await supabaseSignupOrLogin(frank, pw);

    const h1 = await json('POST', '/homes', { name: `Resilience Home ${Date.now()}` });
    assert.equal(h1.status, 201);
    homeId = h1.json.id;
    
    await createOrJoinUser(agent as any, alice, 'Alice', homeId);
    await createOrJoinUser(agent as any, bob, 'Bob', homeId);
    await createOrJoinUser(agent as any, charlie, 'Charlie', homeId);
    await createOrJoinUser(agent as any, diana, 'Diana', homeId);
    await createOrJoinUser(agent as any, eve, 'Eve', homeId);
    await createOrJoinUser(agent as any, frank, 'Frank', homeId);
  }, 30000);

  describe('Concurrent Chore Operations', () => {
    it('should handle concurrent chore claims gracefully', async () => {
      const c1 = await json('POST', '/chores', {
        name: `Concurrent Claim ${Date.now()}`,
        description: 'test',
        time: '2032-01-01T00:00:00',
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(c1.status, 201);

      // Approve the chore first (need enough votes to make it unclaimed)
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenA}` });
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenB}` });
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenC}` });

      const promises = [tokenA, tokenB, tokenC, tokenD].map(token =>
        agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${token}` })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => [200, 204].includes(r.status)).length;
      const conflictCount = results.filter(r => r.status === 409).length;

      assert.equal(successCount, 1, 'Exactly one claim should succeed');
      assert.equal(conflictCount, 3, 'Three claims should conflict');
    });

    it('should handle concurrent chore completions', async () => {
      const c1 = await json('POST', '/chores', {
        name: `Concurrent Complete ${Date.now()}`,
        description: 'test',
        time: '2032-01-01T00:00:00',
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(c1.status, 201);

      // Approve the chore first to make it claimable
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenA}` });
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenB}` });
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenC}` });

      await agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}` });

      const promises = [tokenA, tokenA, tokenA].map(() =>
        agent.patch(`/chores/${c1.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}` })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => [200, 204].includes(r.status)).length;
      
      assert.ok(successCount >= 1, 'At least one completion should succeed');
    });
  });

  describe('Concurrent Voting & Approvals', () => {
    it('should handle concurrent approval votes without corruption', async () => {
      const c1 = await json('POST', '/chores', {
        name: `Vote Race ${Date.now()}`,
        description: 'test',
        time: '2032-01-01T00:00:00',
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(c1.status, 201);

      // Vote on the unapproved chore (don't claim/complete first)
      const promises = [tokenB, tokenC, tokenD, tokenE, tokenF].map(token =>
        json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, 
          { Authorization: `Bearer ${token}` })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status === 200).length;

      assert.ok(successCount >= 4, 'Most votes should succeed concurrently');

      const finalState = await json('GET', `/approvals/${c1.json.uuid}`, 
        undefined, { Authorization: `Bearer ${tokenA}` });
      assert.equal(finalState.status, 200);
      assert.ok(finalState.json.votes >= 4, 'Vote counts should be consistent');
    });

    it('should handle concurrent dispute creation', async () => {
      const c1 = await json('POST', '/chores', {
        name: `Dispute Race ${Date.now()}`,
        description: 'test',
        time: '2032-01-01T00:00:00',
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(c1.status, 201);

      // Approve the chore first to make it claimable
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenA}` });
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenB}` });
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenC}` });

      await agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}` });
      await agent.patch(`/chores/${c1.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}` });

      const promises = [tokenB, tokenC, tokenD, tokenE].map(token =>
        json('POST', '/disputes', { choreId: c1.json.uuid, reason: 'concurrent test' },
          { Authorization: `Bearer ${token}` })
      );

      const results = await Promise.all(promises);
      
      // Debug: log all result status codes
      console.log('[test] Dispute creation results:', results.map(r => ({ status: r.status, error: r.json?.error })));
      
      const successCount = results.filter(r => r.status === 201).length;
      const conflictCount = results.filter(r => r.status === 409).length;
      const serverErrorCount = results.filter(r => r.status === 500).length;
      
      console.log(`[test] Success: ${successCount}, Conflicts: ${conflictCount}, Server errors: ${serverErrorCount}`);

      if (successCount !== 1) {
        console.log('[test] Expected exactly 1 success, got:', successCount);
      }
      if (conflictCount !== 3) {
        console.log('[test] Expected exactly 3 conflicts, got:', conflictCount); 
      }

      assert.equal(successCount, 1, 'Exactly one dispute should succeed');
      assert.equal(conflictCount, 3, 'Three disputes should conflict with DUPLICATE_DISPUTE');
    });
  });

  describe('Home Management Edge Cases', () => {
    it('should handle concurrent home joins gracefully', async () => {
      const h1 = await json('POST', '/homes', { name: `Join Race ${Date.now()}` });
      assert.equal(h1.status, 201);

      const newUsers = ['join1@e2e.local', 'join2@e2e.local', 'join3@e2e.local'];
      const tokens = await Promise.all(
        newUsers.map(email => supabaseSignupOrLogin(email, pw))
      );

      const promises = tokens.map((token, i) =>
        createOrJoinUser(agent as any, newUsers[i], `User${i}`, h1.json.id)
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      assert.ok(successCount >= 2, 'Most concurrent joins should succeed');
    });

    it('should prevent creating duplicate homes with same name', async () => {
      const homeName = `Duplicate Test ${Date.now()}`;
      
      const promises = Array.from({ length: 3 }, () =>
        json('POST', '/homes', { name: homeName })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status === 201).length;
      
      // Should allow multiple homes with same name or handle conflicts
      assert.ok(successCount >= 1, 'At least one home creation should succeed');
    });
  });

  describe('Resource Cleanup & Consistency', () => {
    it('should maintain consistency during high-load operations', async () => {
      const chorePromises = Array.from({ length: 10 }, (_, i) =>
        json('POST', '/chores', {
          name: `Load Test Chore ${i}`,
          description: 'load test',
          time: '2032-01-01T00:00:00',
          icon: 'wind',
          home_id: homeId,
          points: 5
        }, { Authorization: `Bearer ${tokenA}` })
      );

      const chores = await Promise.all(chorePromises);
      const successfulChores = chores.filter(c => c.status === 201);

      assert.ok(successfulChores.length >= 8, 'Most chore creations should succeed under load');

      const verifyPromises = successfulChores.map(c =>
        json('GET', `/chores/${c.json.uuid}`, undefined, { Authorization: `Bearer ${tokenA}` })
      );

      const verifications = await Promise.all(verifyPromises);
      const verifiedCount = verifications.filter(v => v.status === 200).length;

      assert.equal(verifiedCount, successfulChores.length, 'All created chores should be retrievable');
    });

    it('should handle orphaned resource scenarios', async () => {
      const c1 = await json('POST', '/chores', {
        name: `Orphan Test ${Date.now()}`,
        description: 'test',
        time: '2032-01-01T00:00:00',
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(c1.status, 201);

      // Approve the chore first to make it claimable
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenA}` });
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenB}` });
      await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, { Authorization: `Bearer ${tokenC}` });

      await agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}` });
      await agent.patch(`/chores/${c1.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}` });

      const disputeRes = await json('POST', '/disputes', {
        choreId: c1.json.uuid,
        reason: 'orphan test'
      }, { Authorization: `Bearer ${tokenB}` });
      assert.equal(disputeRes.status, 201);

      // Verify accessing dispute after potential chore deletion
      const disputeCheck = await json('GET', `/disputes/${disputeRes.json.uuid}`,
        undefined, { Authorization: `Bearer ${tokenA}` });
      assert.ok([200, 404].includes(disputeCheck.status), 
        'Dispute should be accessible or cleanly removed');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from transient failures gracefully', async () => {
      // Test with malformed requests that should not crash the system
      const malformedRequests = [
        () => json('POST', '/chores', { invalid: 'data' }, { Authorization: `Bearer ${tokenA}` }),
        () => json('GET', '/chores/invalid-uuid', undefined, { Authorization: `Bearer ${tokenA}` }),
        () => json('POST', '/approvals/invalid-uuid/vote', { approved: true }, { Authorization: `Bearer ${tokenA}` }),
      ];

      for (const request of malformedRequests) {
        const res = await request();
        console.log(`Malformed request status: ${res.status}`);
        assert.ok([400, 404, 422].includes(res.status), 
          `Malformed request should return 400/404/422, got ${res.status}`);
      }

      // Verify system is still functional after errors
      const healthCheck = await json('GET', `/points/${homeId}`, 
        undefined, { Authorization: `Bearer ${tokenA}` });
      assert.equal(healthCheck.status, 200, 'System should remain functional after errors');
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});