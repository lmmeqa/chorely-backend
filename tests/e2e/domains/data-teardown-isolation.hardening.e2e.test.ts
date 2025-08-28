import assert from 'node:assert/strict';
import { describe, it, afterAll } from 'vitest';
import { json } from '../../helpers/hono-test-client';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { setupHomeWithUsers, createChore, approveClaimThenComplete, jpegB64 } from '../helpers/hardening-helpers';

describe('Data teardown and isolation', () => {
  afterAll(cleanupTestData);

  it('runs a small E2E flow twice back‑to‑back using the same ephemeral DB to catch leftovers/uniqueness issues', async () => {
    const emails = ['teardown1@example.com', 'teardown2@example.com'];
    
    // First run
    await resetBackendForEmails(emails);
    const { homeId: homeId1, tokens: tokens1 } = await setupHomeWithUsers(emails);
    const chore1 = await createChore(homeId1, tokens1[emails[0]]);
    await approveClaimThenComplete(chore1.uuid, tokens1[emails[0]], jpegB64());
    
    const points1 = await json('GET', `/points/${homeId1}/${emails[0]}`, undefined, { Authorization: `Bearer ${tokens1[emails[0]]}` });
    assert.equal(points1.status, 200);
    const pointsValue1 = points1.json.points;
    
    // Clean up
    await cleanupTestData();
    
    // Second run with same emails
    await resetBackendForEmails(emails);
    const { homeId: homeId2, tokens: tokens2 } = await setupHomeWithUsers(emails);
    const chore2 = await createChore(homeId2, tokens2[emails[0]]);
    await approveClaimThenComplete(chore2.uuid, tokens2[emails[0]], jpegB64());
    
    const points2 = await json('GET', `/points/${homeId2}/${emails[0]}`, undefined, { Authorization: `Bearer ${tokens2[emails[0]]}` });
    assert.equal(points2.status, 200);
    const pointsValue2 = points2.json.points;
    
    // Should be the same points value (no leftover data from first run)
    assert.equal(pointsValue1, pointsValue2);
    
    // Home IDs should be different (fresh homes)
    assert.notEqual(homeId1, homeId2);
  });
});
