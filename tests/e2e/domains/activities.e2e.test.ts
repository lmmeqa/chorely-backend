import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { buildTwoPersonHouse } from '../helpers/test-scenarios';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';
import { waitFor } from '../helpers/wait';
import { expectStatusChangedEvent } from '../helpers/assertions';


describe('Activities E2E', () => {
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
      await createOrJoinUser(agent as any, u.email, u.name, homeId);
    }
  }, 30000);

  it('returns recent activity for home and various timeFrames', async () => {
    const tokenA = tokens[alice.email];
    for (const tf of ['1d','3d','7d','30d']) {
      const r = await json('GET', `/activities?homeId=${encodeURIComponent(homeId)}&timeFrame=${tf}`, undefined, { Authorization: `Bearer ${tokenA}` });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.json));
    }
  });

  it('windowing semantics - fromTs exclusive, toTs inclusive', async () => {
    const tokenA = tokens[alice.email];
    const mid = Date.now();
    
    // toTs inclusive - should include events <= mid
    const left = await json('GET', `/activities?homeId=${homeId}&toTs=${mid}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(left.status, 200);
    assert.ok(Array.isArray(left.json));
    
    // fromTs exclusive - should exclude mid, only events > mid  
    const right = await json('GET', `/activities?homeId=${homeId}&fromTs=${mid}`, undefined, { Authorization: `Bearer ${tokenA}` });
    assert.equal(right.status, 200);
    assert.ok(Array.isArray(right.json));
    
    // Verify fromTs exclusivity
    for (const event of right.json) {
      const eventTs = event.ts || Date.parse(event.created_at);
      assert.ok(eventTs > mid, 'fromTs should be exclusive');
    }
  });

  it('STATUS_CHANGED events after approvals/disputes', async () => {
    const tokenA = tokens[alice.email];
    const tokenB = tokens[bob.email];
    
    // Create chore to trigger status changes
    const chore = await json('POST', '/chores', { 
      name: 'Status Change Test', 
      description: 'test status changed events', 
      time: '2032-01-01T00:00:00', 
      icon: 'wind', 
      home_id: homeId, 
      points: 10 
    }, { Authorization: `Bearer ${tokenA}` });
    assert.equal(chore.status, 201);
    const choreUuid = chore.json.uuid;

    // Approve chore (should trigger status change events)
    await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: alice.email }, { Authorization: `Bearer ${tokenA}` });
    await json('POST', `/approvals/${choreUuid}/vote`, { userEmail: bob.email }, { Authorization: `Bearer ${tokenB}` });
    
    // Claim chore (another status change)
    await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${tokenA}` });
    
    // Complete chore (another status change) 
    await agent.patch(`/chores/${choreUuid}/complete`).set({ Authorization: `Bearer ${tokenA}` }).attach('image', Buffer.from([1,2,3]), { filename: 'status.jpg', contentType: 'image/jpeg' });

    // Poll for STATUS_CHANGED events
    const eventsResp = await waitFor(
      () => json('GET', `/activities?homeId=${homeId}`, undefined, { Authorization: `Bearer ${tokenA}` }),
      (r) => r.status === 200 && r.json.some((e: any) => e.type === 'STATUS_CHANGED')
    );
    
    const statusChangedEvent = eventsResp.json.find((e: any) => e.type === 'STATUS_CHANGED');
    assert.ok(statusChangedEvent, 'Should find STATUS_CHANGED event');
    expectStatusChangedEvent(statusChangedEvent);
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});


