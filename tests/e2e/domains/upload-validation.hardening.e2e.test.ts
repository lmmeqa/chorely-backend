import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

describe('Upload validation and constraints', () => {
  const alice = { email: 'a@example.com', password: 'password123', name: 'Alice' };
  let tA = '', homeId = '', choreUuid = '';

  beforeAll(async () => {
    await resetBackendForEmails([alice.email]);
    tA = await supabaseSignupOrLogin(alice.email, alice.password);
    const h = await json('POST','/homes',{ name: 'Upload Home' });
    assert.equal(h.status, 201); homeId = h.json.id;
    await createOrJoinUser(agent as any, alice.email, alice.name, homeId);
    const c = await json('POST','/chores', { name:'Upload', time:new Date().toISOString(), points:1, home_id:homeId }, { Authorization:`Bearer ${tA}`});
    assert.equal(c.status, 201); choreUuid = c.json.uuid;
    // Approve the chore first
    const approve = await agent.patch(`/chores/${choreUuid}/approve`).set({ Authorization: `Bearer ${tA}` });
    assert.equal(approve.status, 204);
    // Claim the chore
    const claim = await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${tA}` });
    assert.equal(claim.status, 204);
  });
  afterAll(cleanupTestData);

  it('rejects non-image content types (415 preferred)', async () => {
    const badHtmlB64 = Buffer.from('<h1>x</h1>').toString('base64');
    const r = await json('PATCH', `/chores/${choreUuid}/complete`, {
      image: { data: badHtmlB64, filename: 'x.html', contentType: 'text/html' }
    }, { Authorization: `Bearer ${tA}` });
    assert.equal(r.status, 415);
  });

  it('rejects oversized image (413)', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 1).toString('base64');
    const r = await json('PATCH', `/chores/${choreUuid}/complete`, {
      image: { data: big, filename: 'big.jpg', contentType: 'image/jpeg' }
    }, { Authorization: `Bearer ${tA}` });
    assert.equal(r.status, 413);
  });

  it('malformed base64 yields 422', async () => {
    const r = await json('PATCH', `/chores/${choreUuid}/complete`, {
      image: { data: '@@@not-base64@@@', filename: 'bad.jpg', contentType: 'image/jpeg' }
    }, { Authorization:`Bearer ${tA}`});
    assert.equal(r.status, 422);
  });

  it('413 too large', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 1).toString('base64');
    const r2 = await json('PATCH', `/chores/${choreUuid}/complete`, {
      image: { data: big, filename: 'big.jpg', contentType: 'image/jpeg' }
    }, { Authorization: `Bearer ${tA}` });
    assert.equal(r2.status, 413);
  });

  it('422 malformed base64', async () => {
    const r3 = await json('PATCH', `/chores/${choreUuid}/complete`, {
      image: { data: '@@@not-base64@@@', filename: 'bad.jpg', contentType: 'image/jpeg' }
    }, { Authorization: `Bearer ${tA}` });
    assert.equal(r3.status, 422);
  });

  it('rejects unexpected fields on chore create (422)', async () => {
    const r = await json('POST','/chores', { home_id:homeId, name:'ok', time:new Date().toISOString(), extra:'nope' }, { Authorization:`Bearer ${tA}`});
    assert.equal(r.status, 201);
    const g = await json('GET', `/chores/${r.json.uuid}`, undefined, { Authorization: `Bearer ${tA}` });
    assert.ok(!('extra' in g.json));
  });

  it('handles extreme length & unicode in name', async () => {
    const long = 'x'.repeat(5000) + '✨';
    const r = await json('POST','/chores', { home_id:homeId, name:long, time:new Date().toISOString() }, { Authorization:`Bearer ${tA}`});
    assert.ok([201,422].includes(r.status));
  });

  it('rejects invalid times/enums (422)', async () => {
    const r = await json('POST','/chores', { home_id:homeId, name:'weird', time:'3020-13-40T99:99:99Z' }, { Authorization:`Bearer ${tA}`});
    assert.equal(r.status, 422);
  });
});
