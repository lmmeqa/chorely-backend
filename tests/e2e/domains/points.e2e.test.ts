import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';

const agent = request(app);

async function json(method: string, url: string, body?: any, headers?: Record<string, string>) {
  let r: any = agent;
  const h = { Connection: 'close', ...(headers || {}) } as Record<string, string>;
  switch (method.toUpperCase()) {
    case 'GET': r = r.get(url); break;
    case 'POST': r = r.post(url).send(body ?? {}); break;
    case 'PUT': r = r.put(url).send(body ?? {}); break;
    default: throw new Error(`unsupported method ${method}`);
  }
  r = r.set(h);
  const res = await r;
  const text = res.text ?? '';
  try { return { status: res.status, json: JSON.parse(text) } as any; }
  catch { return { status: res.status, json: text } as any; }
}

describe('Points domain E2E', () => {
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

  it('get all points, get for user, add and set points', async () => {
    const tokenA = tokens[alice.email];
    const tokenB = tokens[bob.email];
    const all = await json('GET', `/points/${homeId}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(all.status, 200);
    const forUser = await json('GET', `/points/${homeId}/${encodeURIComponent(alice.email)}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(forUser.status, 200);
    assert.ok(typeof forUser.json.points === 'number');
    const add = await json('POST', `/points/${homeId}/${encodeURIComponent(bob.email)}`, { delta: 2 }, { Authorization: `Bearer ${tokenB}` });
    assert.equal(add.status, 200);
    const set = await json('PUT', `/points/${homeId}/${encodeURIComponent(bob.email)}`, { points: 0 }, { Authorization: `Bearer ${tokenB}` });
    assert.equal(set.status, 200);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


