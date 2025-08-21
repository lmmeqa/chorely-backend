import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { assertMatches, HomeSchema, HomeUsersSchema, WeeklyQuotaSchema } from '../helpers/contracts';

const agent = request(app);

async function json(method: string, url: string, body?: any, headers?: Record<string, string>) {
  let r: any = agent;
  const h = { Connection: 'close', ...(headers || {}) } as Record<string, string>;
  switch (method.toUpperCase()) {
    case 'GET': r = r.get(url); break;
    case 'POST': r = r.post(url).send(body ?? {}); break;
    case 'PATCH': r = r.patch(url).send(body ?? {}); break;
    default: throw new Error(`unsupported method ${method}`);
  }
  r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try { return { status: res.status, json: JSON.parse(text) } as any; }
  catch { return { status: res.status, json: text } as any; }
}

describe('Homes domain E2E', () => {
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
      const r = await json('POST', '/user', { email: u.email, homeIds: [homeId], name: u.name });
      if (r.status === 409) {
        const j = await json('POST', '/user/join', { email: u.email, homeId });
        assert.equal(j.status, 204);
      } else {
        assert.equal(r.status, 201);
      }
    }
  }, 30000);

  it('get home by id, users, and update quota', async () => {
    const tokenA = tokens[alice.email];
    const byId = await json('GET', `/homes/${homeId}`, undefined);
    assert.equal(byId.status, 200);
    assertMatches(HomeSchema, byId.json, 'GET /homes/:id');

    const users = await json('GET', `/homes/${homeId}/users`, undefined);
    assert.equal(users.status, 200);
    assertMatches(HomeUsersSchema, users.json, 'GET /homes/:id/users');
    assert.ok(users.json.some((u: any) => u.email === alice.email));

    const quota = await json('PATCH', `/homes/${homeId}/quota`, { weeklyPointQuota: 10 });
    assert.equal(quota.status, 200);
    assertMatches(WeeklyQuotaSchema, quota.json, 'PATCH /homes/:id/quota');
    assert.equal(quota.json.weeklyPointQuota, 10);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


