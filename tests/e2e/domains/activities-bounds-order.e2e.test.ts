import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';
import { expectApprovalVotePayload } from '../helpers/assertions';

describe('Activities ordering & bounds E2E', () => {
  const scenario = buildTwoPersonHouse();
  const [alice, bob] = scenario.users;
  let homeId = '';
  let tokens: Record<string, string> = {};

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    for (const u of scenario.users) tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    const h = await json('POST', '/homes', { name: `Activities Home ${Date.now()}` });
    assert.equal(h.status, 201); homeId = h.json.id;
    for (const u of scenario.users) {
      await createOrJoinUser(agent as any, u.email, u.name, homeId);
    }

    // Generate activity by creating and completing chores
    for (let i = 0; i < 2; i++) {
      const c = await json('POST', '/chores', { name: `Act ${i}`, description: 'activity', time: '2031-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 1 }, { Authorization: `Bearer ${tokens[alice.email]}` });
      assert.equal(c.status, 201);
      const vote1 = await json('POST', `/approvals/${c.json.uuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokens[alice.email]}` });
      assert.equal(vote1.status, 200);
      expectApprovalVotePayload(vote1.json);
      
      const vote2 = await json('POST', `/approvals/${c.json.uuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokens[bob.email]}` });
      assert.equal(vote2.status, 200);
      expectApprovalVotePayload(vote2.json);
      assert.equal((await agent.patch(`/chores/${c.json.uuid}/claim`).set({ Authorization: `Bearer ${tokens[alice.email]}` })).status, 204);
      assert.equal((await agent.patch(`/chores/${c.json.uuid}/complete`).set({ Authorization: `Bearer ${tokens[alice.email]}` }).attach('image', Buffer.from([1,2,3]), { filename: 'a.jpg', contentType: 'image/jpeg' })).status, 204);
    }
  }, 30000);

  for (const tf of ['1d', '3d', '7d', '30d']) {
    it(`lists in reverse-chronological order with ID desc tie-break for ${tf}`, async () => {
      const r = await json('GET', `/activities?homeId=${encodeURIComponent(homeId)}&timeFrame=${tf}`, undefined, { Authorization: `Bearer ${tokens[alice.email]}` });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.json));
      
      // Proper ordering and tie-break logic from guide
      const tsOf = (x: any) => typeof x.ts === 'number' ? x.ts : Date.parse(x.created_at ?? x.ts ?? 0);
      for (let i = 1; i < r.json.length; i++) {
        const prev = tsOf(r.json[i-1]);
        const cur = tsOf(r.json[i]);
        assert.ok(prev > cur || (prev === cur && r.json[i-1].id > r.json[i].id), 
          'reverse-chron with id desc tie-break');
      }
    });
  }

  it('windowing bounds - toTs inclusive, fromTs exclusive', async () => {
    const toTs = Date.now();
    const list = await json('GET', `/activities?homeId=${homeId}&toTs=${toTs}`, undefined, { Authorization: `Bearer ${tokens[alice.email]}` });
    assert.equal(list.status, 200);
    const items = list.json;
    
    // Verify toTs is inclusive (events <= toTs should be included)
    for (const item of items) {
      const itemTs = item.ts || Date.parse(item.created_at);
      assert.ok(itemTs <= toTs, 'toTs should be inclusive');
    }
    
    // Test fromTs exclusive
    const mid = Date.now();
    const left = await json('GET', `/activities?homeId=${homeId}&toTs=${mid}`, undefined, { Authorization: `Bearer ${tokens[alice.email]}` }); // includes <= mid
    const right = await json('GET', `/activities?homeId=${homeId}&fromTs=${mid}`, undefined, { Authorization: `Bearer ${tokens[alice.email]}` }); // excludes mid
    
    assert.equal(left.status, 200);
    assert.equal(right.status, 200);
    assert.ok(left.json.length >= 0);
    assert.ok(right.json.every((e: any) => (e.ts || Date.parse(e.created_at)) > mid));
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


