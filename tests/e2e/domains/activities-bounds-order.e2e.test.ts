import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

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
      assert.ok([200, 409].includes((await json('POST', `/approvals/${c.json.uuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokens[alice.email]}` })).status));
      assert.ok([200, 409].includes((await json('POST', `/approvals/${c.json.uuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokens[bob.email]}` })).status));
      assert.equal((await agent.patch(`/chores/${c.json.uuid}/claim`).set({ Authorization: `Bearer ${tokens[alice.email]}` })).status, 204);
      assert.equal((await agent.patch(`/chores/${c.json.uuid}/complete`).set({ Authorization: `Bearer ${tokens[alice.email]}` }).attach('image', Buffer.from([1,2,3]), { filename: 'a.jpg', contentType: 'image/jpeg' })).status, 204);
    }
  }, 30000);

  for (const tf of ['1d', '3d', '7d', '30d']) {
    it(`lists in reverse-chronological order for ${tf}`, async () => {
      const r = await json('GET', `/activities?homeId=${encodeURIComponent(homeId)}&timeFrame=${tf}`, undefined, { Authorization: `Bearer ${tokens[alice.email]}` });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.json));
      const toTs = (x: any) => typeof x.ts === 'number' ? x.ts : Date.parse(x.created_at ?? x.ts ?? 0);
      for (let i = 1; i < r.json.length; i++) {
        assert.ok(toTs(r.json[i - 1]) >= toTs(r.json[i]), 'Activities must be reverse-chronological');
      }
    });
  }

  afterAll(async () => {
    await cleanupTestData();
  });
});


