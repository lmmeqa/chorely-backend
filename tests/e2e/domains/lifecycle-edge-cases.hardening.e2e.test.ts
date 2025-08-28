import assert from 'node:assert/strict';
import { describe, it, afterAll } from 'vitest';
import { json } from '../../helpers/hono-test-client';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { setupHomeWithUsers, createChore, approveClaimThenComplete, jpegB64 } from '../helpers/hardening-helpers';

describe('Dispute lifecycle edge cases', () => {
  afterAll(cleanupTestData);

  it('cannot vote after dispute is closed (409)', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['life1@example.com','life2@example.com']);
    const chore = await createChore(homeId, tokens['life1@example.com']);
    await approveClaimThenComplete(chore.uuid, tokens['life1@example.com'], jpegB64());

    const d = await json('POST','/disputes', { choreId: chore.uuid, reason:'lifecycle-test' }, { Authorization:`Bearer ${tokens['life2@example.com']}`});
    assert.equal(d.status, 201);
    await json('PATCH', `/disputes/${d.json.uuid}/sustain`, null, { Authorization:`Bearer ${tokens['life2@example.com']}`});
    const vote = await json('POST', `/dispute-votes/${d.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens['life1@example.com']}`});
    assert.equal(vote.status, 409);
  });

  it('completing while dispute is pending: mirror re-complete behavior → allow 204 or 409; must not award points again', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['pending1@example.com','pending2@example.com']);
    const chore = await createChore(homeId, tokens['pending1@example.com'], { points: 3 });
    await approveClaimThenComplete(chore.uuid, tokens['pending1@example.com'], jpegB64());

    const before = (await json('GET', `/points/${homeId}/pending1@example.com`)).json.points;

    // Open a dispute
    const d = await json('POST','/disputes', { choreId: chore.uuid, reason:'pending-complete-test' }, { Authorization:`Bearer ${tokens['pending2@example.com']}`});
    assert.equal(d.status, 201);

    // Re-complete during pending dispute
    const retry = await json('PATCH', `/chores/${chore.uuid}/complete`, {
      image: { data: jpegB64(), filename: 'p.jpg', contentType: 'image/jpeg' }
    }, { Authorization:`Bearer ${tokens['pending1@example.com']}`});
    assert.ok([204,409].includes(retry.status));

    const after = (await json('GET', `/points/${homeId}/pending1@example.com`)).json.points;
    // Points should not increase (no double award)
    assert.equal(after, before);
  });

  it('cannot complete unclaimed chore (409)', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['unclaimed@example.com']);
    const chore = await createChore(homeId, tokens['unclaimed@example.com']);
    
    const r = await json('PATCH', `/chores/${chore.uuid}/complete`, {
      image: { data: jpegB64(), filename: 'p.jpg', contentType: 'image/jpeg' }
    }, { Authorization:`Bearer ${tokens['unclaimed@example.com']}`});
    assert.equal(r.status, 409);
  });
});
