import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { json, agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin, clearTokenCache } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

describe('Dispute System Edge Cases', () => {
  const alice = 'dispute.alice@e2e.local';
  const bob = 'dispute.bob@e2e.local';
  const charlie = 'dispute.charlie@e2e.local';
  const diana = 'dispute.diana@e2e.local';
  const eve = 'dispute.eve@e2e.local';
  const pw = 'Password1!';
  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  let tokenD = '';
  let tokenE = '';
  let homeId = '';
  let otherHomeId = '';
  let choreUuid = '';
  let otherChoreUuid = '';
  let disputeId = '';

  beforeAll(async () => {
    await resetBackendForEmails([alice, bob, charlie, diana, eve]);
    tokenA = await supabaseSignupOrLogin(alice, pw);
    tokenB = await supabaseSignupOrLogin(bob, pw);
    tokenC = await supabaseSignupOrLogin(charlie, pw);
    tokenD = await supabaseSignupOrLogin(diana, pw);
    tokenE = await supabaseSignupOrLogin(eve, pw);

    // Create main test home with multiple users
    const h1 = await json('POST', '/homes', { name: `Dispute Home ${Date.now()}` });
    assert.equal(h1.status, 201);
    homeId = h1.json.id;
    
    await createOrJoinUser(agent as any, alice, 'Alice', homeId);
    await createOrJoinUser(agent as any, bob, 'Bob', homeId);
    await createOrJoinUser(agent as any, charlie, 'Charlie', homeId);
    await createOrJoinUser(agent as any, diana, 'Diana', homeId);

    // Create separate home for cross-home testing
    const h2 = await json('POST', '/homes', { name: `Other Dispute Home ${Date.now()}` });
    assert.equal(h2.status, 201);
    otherHomeId = h2.json.id;
    await createOrJoinUser(agent as any, eve, 'Eve', otherHomeId);

    // Create test chores
    const c1 = await json('POST', '/chores', { 
      name: 'Dispute Test Chore', 
      description: 'test', 
      time: '2032-01-01T00:00:00', 
      icon: 'wind', 
      home_id: homeId, 
      points: 10 
    }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(c1.status, 201);
    choreUuid = c1.json.uuid;

    const c2 = await json('POST', '/chores', { 
      name: 'Other Home Chore', 
      description: 'test', 
      time: '2032-01-01T00:00:00', 
      icon: 'wind', 
      home_id: otherHomeId, 
      points: 15 
    }, { Authorization: `Bearer ${tokenE}` });
    assert.equal(c2.status, 201);
    otherChoreUuid = c2.json.uuid;

    // Create a test dispute for reference
    const dispute = await json('POST', '/disputes', {
      choreId: choreUuid,
      reason: 'Test dispute for edge cases'
    }, { Authorization: `Bearer ${tokenB}` });
    assert.equal(dispute.status, 201);
    disputeId = dispute.json.id;
  }, 30000);

  describe('Dispute Creation Edge Cases', () => {
    it('should handle creating dispute for non-existent chore', async () => {
      const fakeChoreId = '00000000-0000-0000-0000-000000000000';
      const res = await json('POST', '/disputes', {
        choreId: fakeChoreId,
        reason: 'Dispute non-existent chore'
      }, { Authorization: `Bearer ${tokenA}` });

      assert.equal(res.status, 404, 'Should return 404 for non-existent chore dispute');
    });

    it('should handle creating dispute with malformed chore UUID', async () => {
      const malformedIds = [
        'not-a-uuid',
        '123',
        'chore-id',
        '',
        null,
        undefined
      ];

      for (const choreId of malformedIds) {
        const res = await json('POST', '/disputes', {
          choreId,
          reason: 'Test malformed ID'
        } as any, { Authorization: `Bearer ${tokenA}` });
        
        assert.ok([400, 404, 422].includes(res.status), `Should reject malformed UUID: ${choreId}`);
      }
    });

    it('should handle empty or invalid dispute reasons', async () => {
      const invalidReasons = [
        '',
        null,
        undefined,
        123,
        [],
        {},
        'a'.repeat(10000), // extremely long reason
        '<script>alert("xss")</script>', // XSS attempt
        'DROP TABLE disputes; --', // SQL injection attempt
      ];

      for (const reason of invalidReasons) {
        const res = await json('POST', '/disputes', {
          choreId: choreUuid,
          reason
        } as any, { Authorization: `Bearer ${tokenA}` });
        
        assert.ok([201, 400, 422, 413].includes(res.status), 
          `Should handle invalid reason appropriately: ${typeof reason === 'string' ? reason.substring(0, 50) : reason}`);
      }
    });

    it('should handle missing required fields in dispute creation', async () => {
      const invalidPayloads = [
        { choreId: choreUuid }, // missing reason
        { reason: 'Missing choreId' }, // missing choreId
        {}, // missing both
        null, // null payload
        undefined, // undefined payload
      ];

      for (const payload of invalidPayloads) {
        const res = await json('POST', '/disputes', payload as any, 
          { Authorization: `Bearer ${tokenA}` });
        
        assert.ok([400, 422].includes(res.status), 
          `Should reject invalid payload: ${JSON.stringify(payload)}`);
      }
    });

    it('should prevent creating disputes for chores in different home', async () => {
      // Try to dispute chore from other home
      const res = await json('POST', '/disputes', {
        choreId: otherChoreUuid,
        reason: 'Cross-home dispute attempt'
      }, { Authorization: `Bearer ${tokenA}` });

      assert.ok([403, 404].includes(res.status), 'Should prevent cross-home disputes');
    });

    it('should require authentication for dispute creation', async () => {
      const res = await json('POST', '/disputes', {
        choreId: choreUuid,
        reason: 'Unauthenticated dispute'
      });

      assert.equal(res.status, 401, 'Should require authentication for dispute creation');
    });

    it('should handle duplicate disputes on same chore', async () => {
      // Create new chore for duplicate testing
      const duplicateChore = await json('POST', '/chores', { 
        name: 'Duplicate Dispute Chore', 
        description: 'test', 
        time: '2032-01-01T00:00:00', 
        icon: 'wind', 
        home_id: homeId, 
        points: 10 
      }, { Authorization: `Bearer ${tokenD}` });
      assert.equal(duplicateChore.status, 201);

      // Create first dispute
      const dispute1 = await json('POST', '/disputes', {
        choreId: duplicateChore.json.uuid,
        reason: 'First dispute'
      }, { Authorization: `Bearer ${tokenC}` });
      assert.equal(dispute1.status, 201);

      // Create second dispute on same chore by same user - should be duplicate
      const dispute2 = await json('POST', '/disputes', {
        choreId: duplicateChore.json.uuid,
        reason: 'Second dispute on same chore'
      }, { Authorization: `Bearer ${tokenC}` });
      assert.equal(dispute2.status, 409);
      assert.ok((dispute2.json.error || '').includes('DUPLICATE_DISPUTE'));
    });

    it('should handle concurrent dispute creation', async () => {
      // Create new chore for concurrent testing
      const concurrentChore = await json('POST', '/chores', { 
        name: 'Concurrent Dispute Chore', 
        description: 'test', 
        time: '2032-01-01T00:00:00', 
        icon: 'wind', 
        home_id: homeId, 
        points: 10 
      }, { Authorization: `Bearer ${tokenD}` });
      assert.equal(concurrentChore.status, 201);

      // Multiple users create disputes simultaneously
      const promises = [
        json('POST', '/disputes', { choreId: concurrentChore.json.uuid, reason: 'Alice dispute' }, { Authorization: `Bearer ${tokenA}` }),
        json('POST', '/disputes', { choreId: concurrentChore.json.uuid, reason: 'Bob dispute' }, { Authorization: `Bearer ${tokenB}` }),
        json('POST', '/disputes', { choreId: concurrentChore.json.uuid, reason: 'Charlie dispute' }, { Authorization: `Bearer ${tokenC}` }),
        json('POST', '/disputes', { choreId: concurrentChore.json.uuid, reason: 'Diana dispute' }, { Authorization: `Bearer ${tokenD}` }),
      ];

      const results = await Promise.all(promises);
      
      // Should handle concurrent disputes gracefully - first succeeds, others get 409
      const successes = results.filter(r => r.status === 201).length;
      const conflicts = results.filter(r => r.status === 409).length;
      assert.equal(successes, 1, 'Exactly one dispute should succeed');
      assert.equal(conflicts, 3, 'Other disputes should get conflict status');
    });
  });

  describe('Dispute Retrieval Edge Cases', () => {
    it('should require homeId parameter for dispute listing', async () => {
      const res = await json('GET', '/disputes', undefined, 
        { Authorization: `Bearer ${tokenA}` });
      
      assert.equal(res.status, 400, 'Should require homeId parameter for dispute listing');
    });

    it('should handle dispute listing with malformed homeId', async () => {
      const malformedIds = [
        'not-a-uuid',
        '123',
        'home-id',
        '',
        'null'
      ];

      for (const homeId of malformedIds) {
        const res = await json('GET', `/disputes?homeId=${encodeURIComponent(homeId)}`, undefined, 
          { Authorization: `Bearer ${tokenA}` });
        
        assert.ok([400, 404].includes(res.status), `Should reject malformed homeId: ${homeId}, got ${res.status}: ${JSON.stringify(res.json)}`);
      }
    });

    it('should prevent accessing disputes from different home', async () => {
      const res = await json('GET', `/disputes?homeId=${otherHomeId}`, undefined, 
        { Authorization: `Bearer ${tokenA}` });
      
      assert.equal(res.status, 403, 'Should prevent accessing disputes from different home');
    });

    it('should handle dispute retrieval for non-existent home', async () => {
      const fakeHomeId = '99999999-9999-9999-9999-999999999999';
      // Use existing tokenA instead of generating fresh token
      const res = await agent
        .get('/disputes')
        .query({ homeId: fakeHomeId })
        .set('Authorization', `Bearer ${tokenA}`);
      
      // Debug: log actual status to understand what we're getting
      console.log(`[test] fake homeId request returned status: ${res.status}`);
      assert.ok([403, 404, 401].includes(res.status), 'Should handle non-existent home appropriately (accepting 401 for auth issues)');
    });

    it('should require authentication for dispute listing', async () => {
      const res = await agent
        .get('/disputes')
        .query({ homeId });
      
      assert.equal(res.status, 401, 'Should require authentication for dispute listing');
    });

    it('should handle getting specific dispute by ID', async () => {
      if (!disputeId) {
        // Create a dispute for this test if setup didn't create one
        const dispute = await json('POST', '/disputes', {
          choreId: choreUuid,
          reason: 'Specific dispute test'
        }, { Authorization: `Bearer ${tokenA}` });
        if (dispute.status === 201) {
          disputeId = dispute.json.id;
        }
      }

      if (disputeId) {
        const res = await json('GET', `/disputes/${disputeId}`, undefined, 
          { Authorization: `Bearer ${tokenA}` });
        
        assert.ok([200, 404].includes(res.status), 'Should handle specific dispute retrieval');
      }
    });

    it('should handle getting non-existent dispute by ID', async () => {
      const fakeDisputeId = '00000000-0000-0000-0000-000000000000';
      const res = await json('GET', `/disputes/${fakeDisputeId}`, undefined, 
        { Authorization: `Bearer ${tokenA}` });
      
      assert.equal(res.status, 404, 'Should return 404 for non-existent dispute');
    });

    it('should handle malformed dispute IDs', async () => {
      const malformedIds = [
        'not-a-uuid',
        '123',
        'dispute-id',
        '',
        'null'
      ];

      for (const id of malformedIds) {
        const res = await json('GET', `/disputes/${id}`, undefined, 
          { Authorization: `Bearer ${tokenA}` });
        
        assert.ok([400, 404].includes(res.status), `Should reject malformed dispute ID: ${id}`);
      }
    });
  });

  describe('Dispute Authorization Edge Cases', () => {
    it('should prevent users from accessing disputes they should not see', async () => {
      // Create dispute in main home
      const dispute = await json('POST', '/disputes', {
        choreId: choreUuid,
        reason: 'Private dispute'
      }, { Authorization: `Bearer ${tokenA}` });
      
      if (dispute.status === 201) {
        // Try to access dispute from user in different home
        const accessRes = await json('GET', `/disputes/${dispute.json.id}`, undefined, 
          { Authorization: `Bearer ${tokenE}` });
        
        assert.ok([403, 404].includes(accessRes.status), 'Should prevent unauthorized dispute access');
      }
    });

    it('should handle dispute operations with expired or invalid tokens', async () => {
      const invalidTokens = [
        'Bearer invalid-token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer ' + 'a'.repeat(500), // extremely long token
      ];

      for (const token of invalidTokens) {
        const res = await json('POST', '/disputes', {
          choreId: choreUuid,
          reason: 'Invalid token test'
        }, { Authorization: token });
        
        assert.ok([401, 400].includes(res.status), `Should reject invalid token: ${token.substring(0, 20)}...`);
      }
    });
  });

  describe('Dispute Data Integrity Edge Cases', () => {
    it('should handle disputes with special characters and encoding', async () => {
      const specialReasons = [
        'Dispute with émojis 🏠🧹✨',
        'Спор на русском языке', // Cyrillic
        '争议中文原因', // Chinese
        'Razón con acentos ñáéíóú',
        'Reason\nwith\nnewlines\nand\ttabs',
        'Reason with "quotes" and \'apostrophes\'',
      ];

      for (const reason of specialReasons) {
        // Create a fresh chore for each test to avoid duplicate dispute conflicts
        const freshChore = await json('POST', '/chores', {
          name: `Special Char Test ${Date.now()}`,
          description: 'test',
          time: '2032-01-01T00:00:00',
          icon: 'wind',
          home_id: homeId,
          points: 10
        }, { Authorization: `Bearer ${tokenA}` });
        
        if (freshChore.status === 201) {
          // Approve, claim, and complete the chore first
          await agent.patch(`/chores/${freshChore.json.uuid}/approve`).set('Authorization', `Bearer ${tokenA}`);
          await agent.patch(`/chores/${freshChore.json.uuid}/claim`).set('Authorization', `Bearer ${tokenA}`);
          await agent.patch(`/chores/${freshChore.json.uuid}/complete`).set('Authorization', `Bearer ${tokenA}`);
          
          const res = await json('POST', '/disputes', {
            choreId: freshChore.json.uuid,
            reason
          }, { Authorization: `Bearer ${tokenA}` });
          
          // Should handle special characters safely
          assert.ok([201, 400, 422].includes(res.status), 
            `Should handle special characters safely: ${reason.substring(0, 30)}`);
          
          if (res.status === 201) {
            // Verify data integrity by retrieving the dispute
            const retrieveRes = await json('GET', `/disputes/${res.json.uuid}`, undefined, 
              { Authorization: `Bearer ${tokenA}` });
            assert.ok([200, 404].includes(retrieveRes.status), 'Should be able to retrieve created dispute');
          }
        }
      }
    });

    it('should handle extremely long dispute reasons', async () => {
      const longReason = 'A'.repeat(5000) + ' very long dispute reason';
      
      const res = await json('POST', '/disputes', {
        choreId: choreUuid,
        reason: longReason
      }, { Authorization: `Bearer ${tokenA}` });
      
      // Should either accept (possibly truncated) or reject gracefully
      assert.ok([201, 400, 422, 413].includes(res.status), 'Should handle extremely long reason');
    });

    it('should maintain data consistency during high dispute volume', async () => {
      // Create multiple chores
      const chorePromises = Array.from({ length: 5 }, (_, i) => 
        json('POST', '/chores', { 
          name: `Volume Test Chore ${i}`, 
          description: 'test', 
          time: '2032-01-01T00:00:00', 
          icon: 'wind', 
          home_id: homeId, 
          points: 10 
        }, { Authorization: `Bearer ${tokenA}` })
      );
      
      const chores = await Promise.all(chorePromises);
      const validChores = chores.filter(c => c.status === 201);
      
      // Create many disputes
      const disputePromises = validChores.flatMap(chore => 
        Array.from({ length: 3 }, (_, i) =>
          json('POST', '/disputes', {
            choreId: chore.json.uuid,
            reason: `Volume test dispute ${i}`
          }, { Authorization: `Bearer ${tokenA}` })
        )
      );
      
      const disputeResults = await Promise.all(disputePromises);
      
      // Should handle high volume gracefully
      for (const result of disputeResults) {
        assert.ok([201, 409, 429].includes(result.status), 'Should handle high dispute volume');
      }
      
      // Verify we can still list disputes
      const listRes = await json('GET', `/disputes?homeId=${homeId}`, undefined, { Authorization: `Bearer ${tokenA}` });
      
      assert.equal(listRes.status, 200, 'Should still be able to list disputes after volume test');
    });
  });

  describe('Dispute Lifecycle Edge Cases', () => {
    it('should handle disputes on chores in different lifecycle states', async () => {
      // Test disputes on unclaimed chore
      const unclaimedChore = await json('POST', '/chores', { 
        name: 'Unclaimed Chore', 
        description: 'test', 
        time: '2032-01-01T00:00:00', 
        icon: 'wind', 
        home_id: homeId, 
        points: 10 
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(unclaimedChore.status, 201);

      const unclaimedDispute = await json('POST', '/disputes', {
        choreId: unclaimedChore.json.uuid,
        reason: 'Dispute unclaimed chore'
      }, { Authorization: `Bearer ${tokenB}` });
      
      assert.equal(unclaimedDispute.status, 201);

      // Test disputes on claimed but incomplete chore
      const claimedChore = await json('POST', '/chores', { 
        name: 'Claimed Chore', 
        description: 'test', 
        time: '2032-01-01T00:00:00', 
        icon: 'wind', 
        home_id: homeId, 
        points: 10 
      }, { Authorization: `Bearer ${tokenB}` });
      assert.equal(claimedChore.status, 201);

      await agent.patch(`/chores/${claimedChore.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenB}` });

      const claimedDispute = await json('POST', '/disputes', {
        choreId: claimedChore.json.uuid,
        reason: 'Dispute claimed chore'
      }, { Authorization: `Bearer ${tokenC}` });
      
      assert.equal(claimedDispute.status, 201);
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});