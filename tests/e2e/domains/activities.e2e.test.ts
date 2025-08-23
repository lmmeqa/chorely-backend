import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';


describe('Activities E2E', () => {
  const scenario = buildTwoPersonHouse();
  const [alice, bob] = scenario.users;
  let homeId = '';
  let tokens: Record<string, string> = {};

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    for (const u of scenario.users) tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201); homeId = h.json.id;
    for (const u of scenario.users) {
      await createOrJoinUser(agent as any, u.email, u.name, homeId);
    }
  }, 30000);

  it('returns recent activity for home and various timeFrames', async () => {
    const tokenA = tokens[alice.email];
    for (const tf of ['1d','3d','7d','30d']) {
      const r = await json('GET', `/activities?homeId=${encodeURIComponent(homeId)}&timeFrame=${tf}`, undefined, { Authorization: `Bearer ${tokenA}` });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.json));
    }
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


