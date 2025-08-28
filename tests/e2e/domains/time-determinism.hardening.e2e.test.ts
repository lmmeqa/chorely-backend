import assert from 'node:assert/strict';
import { describe, it, afterAll } from 'vitest';
import { vi } from 'vitest';
import { json } from '../../helpers/hono-test-client';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { setupHomeWithUsers, createChore, approveClaimThenComplete, jpegB64 } from '../helpers/hardening-helpers';

describe('Time determinism and ordering', () => {
  afterAll(cleanupTestData);

  it('activities never include future-dated items', async () => {
    vi.useFakeTimers(); 
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const { homeId, tokens } = await setupHomeWithUsers(['time1@example.com','time2@example.com']);
    const chore = await createChore(homeId, tokens['time1@example.com']);
    await approveClaimThenComplete(chore.uuid, tokens['time1@example.com'], jpegB64());
    
    const r = await json('GET', `/activities?homeId=${homeId}&timeFrame=1d`, undefined, { Authorization: `Bearer ${tokens['time1@example.com']}` });
    assert.equal(r.status, 200);
    for (const x of r.json) assert.ok((x.ts ?? Date.parse(x.createdAt)) <= Date.now());
    vi.useRealTimers();
  });

  it('activities are desc by updatedAt then uuid (stable under equal timestamps)', async () => {
    vi.useFakeTimers();
    const fixedTime = new Date('2025-01-01T12:00:00Z');
    vi.setSystemTime(fixedTime);
    
    const { homeId, tokens } = await setupHomeWithUsers(['order1@example.com','order2@example.com']);
    
    // Create multiple chores with the same timestamp
    const chore1 = await createChore(homeId, tokens['order1@example.com'], { time: fixedTime.toISOString() });
    const chore2 = await createChore(homeId, tokens['order1@example.com'], { time: fixedTime.toISOString() });
    const chore3 = await createChore(homeId, tokens['order1@example.com'], { time: fixedTime.toISOString() });
    
    await approveClaimThenComplete(chore1.uuid, tokens['order1@example.com'], jpegB64());
    await approveClaimThenComplete(chore2.uuid, tokens['order1@example.com'], jpegB64());
    await approveClaimThenComplete(chore3.uuid, tokens['order1@example.com'], jpegB64());
    
    const r = await json('GET', `/activities?homeId=${homeId}&timeFrame=1d`, undefined, { Authorization: `Bearer ${tokens['order1@example.com']}` });
    assert.equal(r.status, 200);
    
    // Verify ordering is stable (desc by updatedAt, then by uuid desc)
    for (let i = 1; i < r.json.length; i++) {
      const prev = r.json[i-1];
      const curr = r.json[i];
      
      const prevTime = prev.updatedAt || prev.createdAt;
      const currTime = curr.updatedAt || curr.createdAt;
      
      if (prevTime === currTime) {
        // If timestamps are equal, uuid should be in descending order
        assert.ok(prev.uuid > curr.uuid, `UUIDs should be in descending order when timestamps are equal`);
      } else {
        // Timestamps should be in descending order
        assert.ok(prevTime > currTime, `Timestamps should be in descending order`);
      }
    }
    
    vi.useRealTimers();
  });
});
