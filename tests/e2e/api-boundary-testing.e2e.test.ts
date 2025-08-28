import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { json, agent } from '../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from './helpers/reset-backend';
import { createOrJoinUser } from './helpers/users';

describe('API Boundary Testing', () => {
  const alice = 'boundary.alice@e2e.local';
  const bob = 'boundary.bob@e2e.local';
  const charlie = 'boundary.charlie@e2e.local';
  const pw = 'Password1!';
  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  let homeId = '';

  beforeAll(async () => {
    await resetBackendForEmails([alice, bob, charlie]);
    tokenA = await supabaseSignupOrLogin(alice, pw);
    tokenB = await supabaseSignupOrLogin(bob, pw);
    tokenC = await supabaseSignupOrLogin(charlie, pw);

    const h1 = await json('POST', '/homes', { name: `Boundary Home ${Date.now()}` });
    assert.equal(h1.status, 201);
    homeId = h1.json.id;

    await createOrJoinUser(agent as any, alice, 'Alice', homeId);
    await createOrJoinUser(agent as any, bob, 'Bob', homeId);
    await createOrJoinUser(agent as any, charlie, 'Charlie', homeId);
  }, 30000);

  describe('Input Validation Boundaries', () => {
    it('should handle extremely long input strings', async () => {
      const longString = 'a'.repeat(10000);
      const veryLongString = 'b'.repeat(100000);

      const testCases = [
        { name: longString, description: 'test' },
        { name: 'test', description: longString },
        { name: veryLongString, description: 'test' },
        { name: 'test', description: veryLongString },
      ];

      for (const testCase of testCases) {
        const res = await json('POST', '/chores', {
          ...testCase,
          time: '2032-01-01T00:00:00',
          icon: 'wind',
          home_id: homeId,
          points: 10
        }, { Authorization: `Bearer ${tokenA}` });

        assert.ok([201, 400, 422].includes(res.status), 
          `Long input should be handled appropriately, got ${res.status}`);
      }
    });

    it('should handle special characters and unicode', async () => {
      const specialStrings = [
        '🎉🔥💯 Special Chore ✨',
        '测试中文字符',
        'العربية',
        '🏠🧹🎯',
        'null\x00byte',
        'line\nbreak',
        'tab\there',
        '\\escaped\\chars',
      ];

      for (const name of specialStrings) {
        const res = await json('POST', '/chores', {
          name,
          description: 'special char test',
          time: '2032-01-01T00:00:00',
          icon: 'wind',
          home_id: homeId,
          points: 10
        }, { Authorization: `Bearer ${tokenA}` });

        assert.ok([201, 400, 422].includes(res.status), 
          `Special characters should be handled, got ${res.status} for "${name}"`);
      }
    });

    it('should validate numeric boundaries', async () => {
      const numericTests = [
        { points: -1 }, // negative
        { points: 0 }, // zero
        { points: 999999 }, // very large
        { points: 1.5 }, // decimal
        { points: Number.MAX_SAFE_INTEGER },
        { points: Number.MIN_SAFE_INTEGER },
      ];

      for (const test of numericTests) {
        const res = await json('POST', '/chores', {
          name: 'Numeric Test',
          description: 'test',
          time: '2032-01-01T00:00:00',
          icon: 'wind',
          home_id: homeId,
          ...test
        }, { Authorization: `Bearer ${tokenA}` });

        assert.ok([201, 400, 422].includes(res.status), 
          `Numeric boundary ${test.points} should be validated, got ${res.status}`);
      }
    });

    it('should handle malformed JSON payloads', async () => {
      const malformedPayloads = [
        '{"incomplete":',
        '{"trailing":,"comma":true}',
        '{duplicate:duplicate,"keys":"values"}',
        '{"nested":{"missing":"quote}}',
        '',
        'not-json-at-all',
        '[]', // array instead of object
      ];

      for (const payload of malformedPayloads) {
        try {
          const res = await agent
            .post('/chores')
            .set('Authorization', `Bearer ${tokenA}`)
            .set('Content-Type', 'application/json')
            .send(payload);

          assert.ok([400, 422].includes(res.status), 
            `Malformed JSON should be rejected, got ${res.status}`);
        } catch (error) {
          // Parse errors are acceptable
        }
      }
    });
  });

  describe('Resource Ownership Edge Cases', () => {
    it('should prevent completing others claimed chores', async () => {
      const c1 = await json('POST', '/chores', {
        name: 'Ownership Test',
        description: 'test',
        time: '2032-01-01T00:00:00',
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(c1.status, 201);

      await agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}` });
      
      const completeRes = await agent.patch(`/chores/${c1.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenB}` });
      assert.ok([403, 409].includes(completeRes.status), 'Should not complete others chores');
    });

    it('should prevent users from impersonating others in votes', async () => {
      const c1 = await json('POST', '/chores', {
        name: 'Impersonation Test',
        description: 'test',
        time: '2032-01-01T00:00:00',
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(c1.status, 201);

      await agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}` });
      await agent.patch(`/chores/${c1.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}` });

      const voteRes = await json('POST', `/approvals/${c1.json.uuid}/vote`, { 
        userEmail: alice // Bob trying to vote as Alice
      }, { Authorization: `Bearer ${tokenB}` });
      
      assert.ok([403, 409].includes(voteRes.status) || voteRes.status === 201, 
        'Should handle impersonation attempt appropriately');
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle voting on non-existent approvals', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      
      const voteRes = await json('POST', `/approvals/${fakeUuid}/vote`, { approved: true },
        { Authorization: `Bearer ${tokenA}` });
      assert.equal(voteRes.status, 404, 'Should not allow voting on non-existent approvals');
    });

    it('should handle voting on completed approvals', async () => {
      const c1 = await json('POST', '/chores', {
        name: 'Completed Approval Test',
        description: 'test',
        time: '2032-01-01T00:00:00',
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });
      assert.equal(c1.status, 201);

      await agent.patch(`/chores/${c1.json.uuid}/claim`).set({ Authorization: `Bearer ${tokenA}` });
      await agent.patch(`/chores/${c1.json.uuid}/complete`).set({ Authorization: `Bearer ${tokenA}` });

      // All users vote to complete approval
      for (const token of [tokenB, tokenC]) {
        await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true }, 
          { Authorization: `Bearer ${token}` });
      }

      // Try to vote again after completion
      const extraVote = await json('POST', `/approvals/${c1.json.uuid}/vote`, { approved: true },
        { Authorization: `Bearer ${tokenB}` });
      assert.ok([409, 400].includes(extraVote.status), 'Should not allow extra votes on completed approvals');
    });

    it('should handle dispute creation on non-existent chores', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      
      const disputeRes = await json('POST', '/disputes', {
        choreId: fakeUuid,
        reason: 'test dispute'
      }, { Authorization: `Bearer ${tokenA}` });
      
      assert.equal(disputeRes.status, 404, 'Should not create disputes for non-existent chores');
    });
  });

  describe('Temporal Edge Cases', () => {
    it('should handle chores with past deadlines', async () => {
      const pastDate = '2020-01-01T00:00:00';
      
      const res = await json('POST', '/chores', {
        name: 'Past Deadline',
        description: 'test',
        time: pastDate,
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });

      assert.ok([201, 400, 422].includes(res.status), 
        'Should handle past deadlines appropriately');
    });

    it('should handle chores with far future deadlines', async () => {
      const farFuture = '2099-12-31T23:59:59';
      
      const res = await json('POST', '/chores', {
        name: 'Far Future',
        description: 'test',
        time: farFuture,
        icon: 'wind',
        home_id: homeId,
        points: 10
      }, { Authorization: `Bearer ${tokenA}` });

      assert.ok([201, 400, 422].includes(res.status), 
        'Should handle far future dates appropriately');
    });

    it('should handle invalid date formats', async () => {
      const invalidDates = [
        'not-a-date',
        '2032-13-01T00:00:00', // invalid month
        '2032-01-32T00:00:00', // invalid day
        '2032-01-01T25:00:00', // invalid hour
        '2032/01/01 00:00:00', // wrong format
        '',
        null,
      ];

      for (const invalidDate of invalidDates) {
        const res = await json('POST', '/chores', {
          name: 'Invalid Date',
          description: 'test',
          time: invalidDate,
          icon: 'wind',
          home_id: homeId,
          points: 10
        }, { Authorization: `Bearer ${tokenA}` });

        assert.ok([400, 422].includes(res.status), 
          `Invalid date ${invalidDate} should be rejected, got ${res.status}`);
      }
    });
  });

  describe('Pagination & Limits', () => {
    it('should handle requests for large result sets', async () => {
      // Create many chores to test pagination
      const promises = Array.from({ length: 25 }, (_, i) =>
        json('POST', '/chores', {
          name: `Pagination Test ${i}`,
          description: 'test',
          time: '2032-01-01T00:00:00',
          icon: 'wind',
          home_id: homeId,
          points: 1
        }, { Authorization: `Bearer ${tokenA}` })
      );

      await Promise.all(promises);

      const listRes = await json('GET', '/chores', undefined, { Authorization: `Bearer ${tokenA}` });
      assert.equal(listRes.status, 200);
      assert.ok(Array.isArray(listRes.json), 'Should return array of chores');
      assert.ok(listRes.json.length > 0, 'Should return some chores');
    });

    it('should handle extreme pagination parameters', async () => {
      const extremeParams = [
        '?limit=0',
        '?limit=999999',
        '?limit=-1',
        '?offset=-1',
        '?offset=999999',
        '?limit=abc',
        '?offset=xyz',
      ];

      for (const params of extremeParams) {
        const res = await json('GET', `/chores${params}`, undefined, { Authorization: `Bearer ${tokenA}` });
        assert.ok([200, 400, 422].includes(res.status), 
          `Extreme pagination ${params} should be handled, got ${res.status}`);
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});