import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';

import { json, agent } from '../../helpers/hono-test-client';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { assertMatches, ChoreArrayMinimalSchema } from '../helpers/contracts';
describe('Chores domain E2E', () => {
  const scenario = buildTwoPersonHouse();
  const [alice, bob] = scenario.users;
  let homeId = '';
  let tokens: Record<string, string> = {};
  let choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails(scenario.users.map(u => u.email));
    for (const u of scenario.users) tokens[u.email] = await supabaseSignupOrLogin(u.email, u.password);
    const h = await json('POST', '/homes', { name: scenario.homeName });
    assert.equal(h.status, 201); homeId = h.json.id;
    for (const u of scenario.users) {
      const r = await json('POST', '/user', { email: u.email, homeIds: [homeId], name: u.name });
      if (r.status === 409) {
        const j = await json('POST', '/user/join', { email: u.email, homeId });
        assert.equal(j.status, 204);
      } else {
        assert.equal(r.status, 201);
      }
    }
  }, 30000);

  it('lists unapproved chores then available chores after approval, user chores after claim, and get by id', async () => {
    const tokenA = tokens[alice.email];
    // Create chore (starts unapproved)
    const create = await json('POST', '/chores', {
      name: 'Domain Chore', description: 'domain test', time: '2035-01-01T00:00:00', icon: 'wind', home_id: homeId, points: 2,
    }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(create.status, 201);
    choreUuid = create.json.uuid as string;

    // Unapproved list includes it
    const unapproved = await json('GET', `/chores/unapproved/${homeId}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(unapproved.status, 200);
    assertMatches(ChoreArrayMinimalSchema, unapproved.json, 'GET /chores/unapproved/:homeId');
    assert.ok(unapproved.json.some((c: any) => c.uuid === choreUuid));

    // Approve
    const approve = await json('PATCH', `/chores/${choreUuid}/approve`, {}, { Authorization: `Bearer ${tokenA}` });
    assert.equal(approve.status, 204);

    // Now available list includes it
    const available = await json('GET', `/chores/available/${homeId}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(available.status, 200);
    assertMatches(ChoreArrayMinimalSchema, available.json, 'GET /chores/available/:homeId');
    assert.ok(available.json.some((c: any) => c.uuid === choreUuid));

    // Claim by Alice
    const claim = await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${tokenA}` });
    assert.equal(claim.status, 204);

    // User chores list includes it for Alice
    const userChores = await json('GET', `/chores/user?homeId=${encodeURIComponent(homeId)}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(userChores.status, 200);
    assert.ok(userChores.json.some((c: any) => c.uuid === choreUuid));

    // Get by id works
    const byId = await json('GET', `/chores/${choreUuid}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(byId.status, 200);
    assert.equal(byId.json.uuid, choreUuid);
  });

  it('verify endpoint is deprecated and returns 410', async () => {
    const tokenA = tokens[alice.email];
    const verify = await json('PATCH', `/chores/${choreUuid}/verify`, {}, { Authorization: `Bearer ${tokenA}` });
    assert.equal(verify.status, 410);
    assert.ok(verify.json && typeof verify.json === 'object');
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
