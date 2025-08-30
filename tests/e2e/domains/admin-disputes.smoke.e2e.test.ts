import assert from 'node:assert/strict';
import { describe, it, afterAll } from 'vitest';
import { json } from '../../helpers/hono-test-client';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { setupHomeWithUsers, createChore, claimThenComplete, jpegB64 } from '../helpers/hardening-helpers';

// CONTRACT (future feature):
// - Opener auto-sustain; completer forbidden (403).
// - Strict majority >50% of current members; first to cross closes.
// - 24h timeout → auto-overrule if no majority.
// - Sustained: revert complete→claimed; deduct exactly-awarded points; ≤1 STATUS_CHANGED.
// - Overruled: keep complete; 0 STATUS_CHANGED.
// - Once closed: subsequent votes/patch = 409.

describe('Admin disputes smoke tests', () => {
  afterAll(cleanupTestData);

  const AUTO_RES = process.env.AUTO_RES === '1';
  (AUTO_RES ? it : it.skip)('PATCH /disputes/:uuid/sustain|overrule close the dispute and enforce the same side effects', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['ad1@example.com','ad2@example.com']);
    const chore = await createChore(homeId, tokens['ad1@example.com'], { points: 2 });
    await claimThenComplete(chore.uuid, tokens['ad1@example.com'], jpegB64());

    const d1 = await json('POST','/disputes',{ choreId: chore.uuid, reason:'manual' }, { Authorization:`Bearer ${tokens['ad2@example.com']}`});
    assert.equal(d1.status, 201);

    // Sustain manually
    const p = await json('PATCH', `/disputes/${d1.json.uuid}/sustain`, null, { Authorization:`Bearer ${tokens['ad2@example.com']}`});
    assert.equal(p.status, 204);
    const g = await json('GET', `/disputes/${d1.json.uuid}`, undefined, { Authorization:`Bearer ${tokens['ad2@example.com']}`});
    assert.equal(g.json.status, 'sustained');

    // Further votes or second patch return 409
    const again = await json('PATCH', `/disputes/${d1.json.uuid}/sustain`, null, { Authorization:`Bearer ${tokens['ad2@example.com']}`});
    assert.equal(again.status, 409);
    const vote = await json('POST', `/dispute-votes/${d1.json.uuid}/vote`, { overrule:true }, { Authorization:`Bearer ${tokens['ad1@example.com']}`});
    assert.equal(vote.status, 409);
  });

  (AUTO_RES ? it : it.skip)('cannot vote after dispute is closed (409)', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['close1@example.com','close2@example.com']);
    const chore = await createChore(homeId, tokens['close1@example.com']);
    await claimThenComplete(chore.uuid, tokens['close1@example.com'], jpegB64());

    const d = await json('POST','/disputes', { choreId: chore.uuid, reason:'closed-test' }, { Authorization:`Bearer ${tokens['close2@example.com']}`});
    assert.equal(d.status, 201);
    await json('PATCH', `/disputes/${d.json.uuid}/sustain`, null, { Authorization:`Bearer ${tokens['close2@example.com']}`});
    const vote = await json('POST', `/dispute-votes/${d.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens['close1@example.com']}`});
    assert.equal(vote.status, 409);
  });
});
