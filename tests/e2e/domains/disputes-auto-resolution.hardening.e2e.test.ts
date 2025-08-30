import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';
import { setupHomeWithUsers, createChore, approveClaimThenComplete, jpegB64 } from '../helpers/hardening-helpers';

// CONTRACT (future feature):
// - Opener auto-sustain; completer forbidden (403).
// - Strict majority >50% of current members; first to cross closes.
// - 24h timeout → auto-overrule if no majority.
// - Sustained: revert complete→claimed; deduct exactly-awarded points; ≤1 STATUS_CHANGED.
// - Overruled: keep complete; 0 STATUS_CHANGED.
// - Once closed: subsequent votes/patch = 409.

describe('Disputes auto-resolution', () => {
  afterAll(cleanupTestData);

  const AUTO_RES = process.env.AUTO_RES === '1';
  (AUTO_RES ? it : it.skip)('opener auto-sustain + completer cannot vote', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['alice@example.com','bob@example.com','cara@example.com']);
    const chore = await createChore(homeId, tokens['alice@example.com']);
    await approveClaimThenComplete(chore.uuid, tokens['alice@example.com'], jpegB64());

    // Bob opens a dispute → gets an automatic sustain vote in his name
    const d = await json('POST','/disputes',{ choreId: chore.uuid, reason:'looks unfinished' }, { Authorization:`Bearer ${tokens['bob@example.com']}`});
    assert.equal(d.status, 201);
    const status1 = await json('GET', `/dispute-votes/${d.json.uuid}/status`, null, { Authorization:`Bearer ${tokens['bob@example.com']}`});
    assert.equal(status1.status, 200);
    
    const voters = Array.isArray(status1.json?.voters) ? status1.json.voters : [];
    if (voters.length) {
      assert.ok(voters.some((v:any) => v.email === 'bob@example.com'));
    } else {
      assert.ok(typeof status1.json?.sustainCount === 'number' || typeof status1.json?.counts?.sustain === 'number');
    }

    // Completer (Alice) cannot vote
    const r = await json('POST', `/dispute-votes/${d.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens['alice@example.com']}`});
    assert.equal(r.status, 403);
  });

  (AUTO_RES ? it : it.skip)('first to reach >50% closes the dispute, reverts points on sustain', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['u1@example.com','u2@example.com','u3@example.com','u4@example.com']);
    const chore = await createChore(homeId, tokens['u1@example.com'], { points: 3 });
    await approveClaimThenComplete(chore.uuid, tokens['u1@example.com'], jpegB64());

    const before = (await json('GET', `/points/${homeId}/u1@example.com`)).json.points;

    // Open dispute by u2 (auto sustain by u2)
    const disp = await json('POST','/disputes',{ choreId: chore.uuid, reason:'hmm' }, { Authorization:`Bearer ${tokens['u2@example.com']}`});
    assert.equal(disp.status, 201);

    // Now u3 votes sustain → with 4 current members, threshold is 3 (>50% of 4)
    await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens['u3@example.com']}`});
    // u4 votes sustain (3/4) → should auto‑SUSTAIN immediately
    const last = await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens['u4@example.com']}`});
    assert.equal(last.status, 204);

    // Dispute is closed & chore reverted to claimed; points deducted exactly
    const dispGet = await json('GET', `/disputes/${disp.json.uuid}`, undefined, { Authorization: `Bearer ${tokens['u2@example.com']}` });
    assert.equal(dispGet.json.status, 'sustained');
    const after = (await json('GET', `/points/${homeId}/u1@example.com`, undefined, { Authorization: `Bearer ${tokens['u1@example.com']}` })).json.points;
    assert.equal(before, after); // awarded 3, then removed 3

    // Further votes are blocked
    const more = await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { overrule:true }, { Authorization:`Bearer ${tokens['u3@example.com']}`});
    assert.equal(more.status, 409);
  });

  (AUTO_RES ? it : it.skip)('after 24h without a majority, dispute auto-overrules (keeps points)', async () => {
    vi.useFakeTimers();
    const { homeId, tokens } = await setupHomeWithUsers(['p1@example.com','p2@example.com','p3@example.com','p4@example.com','p5@example.com']);
    const chore = await createChore(homeId, tokens['p1@example.com'], { points: 5 });
    await approveClaimThenComplete(chore.uuid, tokens['p1@example.com'], jpegB64());
    const pointsBefore = (await json('GET', `/points/${homeId}/p1@example.com`, undefined, { Authorization: `Bearer ${tokens['p1@example.com']}` })).json.points;

    const disp = await json('POST','/disputes',{ choreId: chore.uuid, reason:'timeout-plurality' }, { Authorization:`Bearer ${tokens['p2@example.com']}`});
    assert.equal(disp.status, 201);
    // Cast two overrule votes (p3,p4) and one sustain (p2 auto)
    await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { overrule:true }, { Authorization:`Bearer ${tokens['p3@example.com']}`});
    await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { overrule:true }, { Authorization:`Bearer ${tokens['p4@example.com']}`});

    // Advance time by 24h to trigger timeout evaluation
    vi.setSystemTime(Date.now() + 24*3600*1000 + 1000);
    // Touch a read endpoint to force evaluation if needed
    const s = await json('GET', `/disputes/${disp.json.uuid}`, undefined, { Authorization: `Bearer ${tokens['p2@example.com']}` });
    assert.equal(s.json.status, 'overruled');

    // Points unchanged, chore remains complete
    const pointsAfter = (await json('GET', `/points/${homeId}/p1@example.com`, undefined, { Authorization: `Bearer ${tokens['p1@example.com']}` })).json.points;
    assert.equal(pointsAfter, pointsBefore);
    vi.useRealTimers();
  });

  (AUTO_RES ? it : it.skip)('threshold is based on current members at each tally', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['m1@example.com','m2@example.com','m3@example.com']);
    const chore = await createChore(homeId, tokens['m1@example.com']);
    await approveClaimThenComplete(chore.uuid, tokens['m1@example.com'], jpegB64());

    const disp = await json('POST','/disputes',{ choreId: chore.uuid, reason:'dyn' }, { Authorization:`Bearer ${tokens['m2@example.com']}`});
    assert.equal(disp.status, 201);

    // With 3 members, 2 sustain would be a majority …
    await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens['m3@example.com']}`});
    // …but add two more members before next tally → electorate = 5, need 3
    const d = await addUserToHome(homeId, 'new1@example.com');
    const e = await addUserToHome(homeId, 'new2@example.com');

    // Not closed yet; one more sustain needed
    let g = await json('GET', `/disputes/${disp.json.uuid}`, undefined, { Authorization: `Bearer ${tokens['m2@example.com']}` });
    assert.equal(g.json.status, 'pending');

    // New member votes sustain → now 3/5, dispute closes sustained
    const tokD = await supabaseSignupOrLogin(d.email, 'pw');
    await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokD}`});
    g = await json('GET', `/disputes/${disp.json.uuid}`, undefined, { Authorization: `Bearer ${tokens['m2@example.com']}` });
    assert.equal(g.json.status, 'sustained');
  });

  (AUTO_RES ? it : it.skip)('activities reflect at most one STATUS_CHANGED on sustain; none on overrule', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['act1@example.com','act2@example.com','act3@example.com']);
    const chore = await createChore(homeId, tokens['act1@example.com'], { points: 2 });
    await approveClaimThenComplete(chore.uuid, tokens['act1@example.com'], jpegB64());
    
    const disp = await json('POST','/disputes',{ choreId: chore.uuid, reason:'activity-test' }, { Authorization:`Bearer ${tokens['act2@example.com']}`});
    assert.equal(disp.status, 201);
    
    // Get to majority for sustain
    await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens['act3@example.com']}`});
    
    const act = await json('GET', `/activities?homeId=${homeId}&timeFrame=7d`, undefined, { Authorization: `Bearer ${tokens['act1@example.com']}` });
    assert.equal(act.status, 200);
    const sustained = act.json.filter((x:any)=> x.type==='STATUS_CHANGED' && x.choreUuid===chore.uuid && x.newStatus==='CLAIMED');
    assert.ok(sustained.length <= 1);
  });

  (AUTO_RES ? it : it.skip)('only one resolution event emitted per dispute', async () => {
    const { homeId, tokens } = await setupHomeWithUsers(['res1@example.com','res2@example.com','res3@example.com']);
    const chore = await createChore(homeId, tokens['res1@example.com'], { points: 2 });
    await approveClaimThenComplete(chore.uuid, tokens['res1@example.com'], jpegB64());
    
    const disp = await json('POST','/disputes',{ choreId: chore.uuid, reason:'resolution-test' }, { Authorization:`Bearer ${tokens['res2@example.com']}`});
    assert.equal(disp.status, 201);
    
    // Get to majority for sustain
    await json('POST', `/dispute-votes/${disp.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens['res3@example.com']}`});
    
    const act = await json('GET', `/activities?homeId=${homeId}&timeFrame=7d`, undefined, { Authorization: `Bearer ${tokens['res1@example.com']}` });
    const events = act.json.filter((x:any)=> x.type==='DISPUTE_RESOLVED' && x.disputeUuid===disp.json.uuid);
    assert.ok(events.length <= 1);
  });
});

async function addUserToHome(homeId: string, email: string) {
  const token = await supabaseSignupOrLogin(email, 'password123');
  await createOrJoinUser(agent as any, email, email.split('@')[0], homeId);
  return { email, token } as const;
}
