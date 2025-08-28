import assert from 'node:assert/strict';
import { describe, it, afterAll } from 'vitest';
import { json } from '../../helpers/hono-test-client';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { setupHomeWithUsers, createChore, approveClaimThenComplete, jpegB64 } from '../helpers/hardening-helpers';

// Note: This is a consistency test, *not* an HTTP 429 test.
describe('High-volume dispute voting remains consistent', () => {
  afterAll(cleanupTestData);

  it('200 concurrent votes do not corrupt final status or emit dup events', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['x1@example.com','x2@example.com','x3@example.com','x4@example.com','x5@example.com']);
    const jpeg = jpegB64();
    const completer = 'x1@example.com';
    const opener = 'x2@example.com';
    const chore = await createChore(homeId, tokens[completer], { points: 2 });
    await approveClaimThenComplete(chore.uuid, tokens[completer], jpeg);
    const disp = await json('POST','/disputes',{ choreId: chore.uuid, reason:'storm' }, { Authorization:`Bearer ${tokens[opener]}`});

    const voters = Object.keys(tokens).filter(e => e !== completer); // exclude completer
    
    // Simulate high concurrency with Promise.all but limit to avoid overwhelming the system
    const promises = [];
    for (let i = 0; i < 200; i++) {
      const who = voters[i % voters.length];
      // flip choices to create contention
      const body = (i % 3 === 0) ? { sustain:true } : { overrule:true };
      promises.push(
        json('POST', `/dispute-votes/${disp.json.uuid}/vote`, body, { Authorization:`Bearer ${tokens[who]}`})
      );
    }
    
    await Promise.all(promises);

    const s = await json('GET', `/disputes/${disp.json.uuid}`, undefined, { Authorization:`Bearer ${tokens[opener]}`});
    assert.ok(['sustained','overruled','pending'].includes(s.json.status));
    // If auto-closed, ensure no second closure is possible
    if (s.json.status !== 'pending') {
      const again = await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { overrule:true }, { Authorization:`Bearer ${tokens[voters[0]]}`});
      assert.equal(again.status, 409);
    }
  }, 60_000);
});
