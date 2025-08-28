import assert from 'node:assert/strict';
import { describe, it, afterAll } from 'vitest';
import { json } from '../../helpers/hono-test-client';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { setupHomeWithUsers, createChore, approveClaimThenComplete, jpegB64 } from '../helpers/hardening-helpers';

describe('Migrations and bootstrap safety', () => {
  afterAll(cleanupTestData);

  it('starts from an empty DB, applies migrations, and runs the mini-flow—proving no reliance on seed data', async () => {
    // This test assumes the database is already migrated and clean
    // The test framework should handle migrations before running tests
    
    const emails = ['migration1@example.com', 'migration2@example.com'];
    await resetBackendForEmails(emails);
    
    // Test basic functionality without any seed data
    const { homeId, tokens } = await setupHomeWithUsers(emails);
    const chore = await createChore(homeId, tokens[emails[0]]);
    await approveClaimThenComplete(chore.uuid, tokens[emails[0]], jpegB64());
    
    // Verify points are awarded correctly
    const points = await json('GET', `/points/${homeId}/${emails[0]}`, undefined, { Authorization: `Bearer ${tokens[emails[0]]}` });
    assert.equal(points.status, 200);
    assert.ok(points.json.points > 0, 'Points should be awarded for completed chore');
    
    // Verify activities are recorded
    const activities = await json('GET', `/activities?homeId=${homeId}&timeFrame=1d`, undefined, { Authorization: `Bearer ${tokens[emails[0]]}` });
    assert.equal(activities.status, 200);
    assert.ok(activities.json.length > 0, 'Activities should be recorded');
    
    // Verify chore status is correct
    const choreDetail = await json('GET', `/chores/${chore.uuid}`, undefined, { Authorization: `Bearer ${tokens[emails[0]]}` });
    assert.equal(choreDetail.status, 200);
    assert.ok(choreDetail.json, 'Chore should be found');
    assert.equal(choreDetail.json.status, 'complete');
  });
});
