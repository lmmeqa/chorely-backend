import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { json, agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin } from '../helpers/supabase';
import { resetBackendForEmails, cleanupTestData } from '../helpers/reset-backend';
import { createOrJoinUser } from '../helpers/users';

function jpegB64(){ return Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64'); }

describe('Multi-home chaos (isolation, points, activities)', () => {
  const emailsA = ['a1@example.com','a2@example.com','a3@example.com'];
  const emailsB = ['b1@example.com','b2@example.com','b3@example.com'];
  const all = [...emailsA, ...emailsB];
  let tokens: Record<string,string> = {}; let homeA = ''; let homeB = '';
  const choresA: string[] = []; const choresB: string[] = [];

  beforeAll(async () => {
    await resetBackendForEmails(all);
    // Sign up users with staggered delays to avoid rate limits
    const signupPromises = all.map(async (e, index) => {
      // Stagger requests by 200ms to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, index * 200));
      const token = await supabaseSignupOrLogin(e, 'Password1!');
      tokens[e] = token;
    });
    await Promise.all(signupPromises);
    // Create homes
    const rA = await json('POST','/homes',{ name: 'Home A' }); assert.equal(rA.status, 201); homeA = rA.json.id;
    const rB = await json('POST','/homes',{ name: 'Home B' }); assert.equal(rB.status, 201); homeB = rB.json.id;
    // Join users
    for (const e of emailsA) await createOrJoinUser(agent as any, e, e.split('@')[0], homeA);
    for (const e of emailsB) await createOrJoinUser(agent as any, e, e.split('@')[0], homeB);
    // Seed chores (8 each)
    for (let i=0;i<8;i++){
      const cA = await json('POST','/chores',{ home_id:homeA, name:`A-${i}`, time:new Date().toISOString(), points: (i%3)+1 }, { Authorization:`Bearer ${tokens[emailsA[0]]}`});
      const cB = await json('POST','/chores',{ home_id:homeB, name:`B-${i}`, time:new Date().toISOString(), points: (i%3)+1 }, { Authorization:`Bearer ${tokens[emailsB[0]]}`});
      assert.equal(cA.status,201); assert.equal(cB.status,201);
      choresA.push(cA.json.uuid); choresB.push(cB.json.uuid);
      
      // Approve chores to make them claimable
      for (const email of emailsA) {
        await agent.patch(`/chores/${cA.json.uuid}/approve`).set({ Authorization: `Bearer ${tokens[email]}` });
      }
      for (const email of emailsB) {
        await agent.patch(`/chores/${cB.json.uuid}/approve`).set({ Authorization: `Bearer ${tokens[email]}` });
      }
    }
  });
  afterAll(cleanupTestData);

  async function claimAndComplete(token: string, uuid: string){
    const claim = await agent.patch(`/chores/${uuid}/claim`).set({ Authorization: `Bearer ${token}` });
    // Claim may fail if already claimed by another user (409) - that's OK
    assert.ok([204, 409].includes(claim.status));
    
    // Only try to complete if we successfully claimed it
    if (claim.status === 204) {
      const comp = await json('PATCH', `/chores/${uuid}/complete`, { image: { data: jpegB64(), filename:'p.jpg', contentType:'image/jpeg' } }, { Authorization:`Bearer ${token}`});
      assert.ok([204,409].includes(comp.status));
    }
  }

  it('parallel activity in Home A and Home B stays isolated', async () => {
    // Parallel claims within each home (introduce races by overlapping)
    await Promise.all([
      // Home A: a1 vs a2 on first two chores
      agent.patch(`/chores/${choresA[0]}/claim`).set({ Authorization: `Bearer ${tokens[emailsA[0]]}` }),
      agent.patch(`/chores/${choresA[0]}/claim`).set({ Authorization: `Bearer ${tokens[emailsA[1]]}` }),
      agent.patch(`/chores/${choresA[1]}/claim`).set({ Authorization: `Bearer ${tokens[emailsA[1]]}` }),
      agent.patch(`/chores/${choresA[1]}/claim`).set({ Authorization: `Bearer ${tokens[emailsA[2]]}` }),
      // Home B: similar
      agent.patch(`/chores/${choresB[0]}/claim`).set({ Authorization: `Bearer ${tokens[emailsB[0]]}` }),
      agent.patch(`/chores/${choresB[0]}/claim`).set({ Authorization: `Bearer ${tokens[emailsB[1]]}` }),
      agent.patch(`/chores/${choresB[1]}/claim`).set({ Authorization: `Bearer ${tokens[emailsB[1]]}` }),
      agent.patch(`/chores/${choresB[1]}/claim`).set({ Authorization: `Bearer ${tokens[emailsB[2]]}` }),
    ]);

    // Complete first 4 chores in each home by their winners
    for (const [i,uuid] of choresA.slice(0,4).entries()) await claimAndComplete(tokens[emailsA[i%3]], uuid);
    for (const [i,uuid] of choresB.slice(0,4).entries()) await claimAndComplete(tokens[emailsB[i%3]], uuid);

    // Open a dispute on #2 of each home by a different user
    const dA = await json('POST','/disputes', { choreId: choresA[2], reason: 'A-2 bad' }, { Authorization:`Bearer ${tokens[emailsA[1]]}`});
    const dB = await json('POST','/disputes', { choreId: choresB[2], reason: 'B-2 bad' }, { Authorization:`Bearer ${tokens[emailsB[1]]}`});
    assert.equal(dA.status,201); assert.equal(dB.status,201);

    // Vote once each (status endpoint should reflect voters from same home only)
    const vA = await json('POST', `/dispute-votes/${dA.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens[emailsA[2]]}`});
    const vB = await json('POST', `/dispute-votes/${dB.json.uuid}/vote`, { overrule:true }, { Authorization:`Bearer ${tokens[emailsB[2]]}`});
    assert.equal(vA.status,200); assert.equal(vB.status,200);

    // Cross-home misuse should fail (user from Home A cannot vote in Home B)
    const cross = await json('POST', `/dispute-votes/${dB.json.uuid}/vote`, { sustain:true }, { Authorization:`Bearer ${tokens[emailsA[0]]}`});
    assert.equal(cross.status, 403);

    // Activities filtered by home contain only their own UUIDs
    const actA = await json('GET', `/activities?homeId=${homeA}&timeFrame=7d`, undefined, { Authorization: `Bearer ${tokens[emailsA[0]]}` });
    const actB = await json('GET', `/activities?homeId=${homeB}&timeFrame=7d`, undefined, { Authorization: `Bearer ${tokens[emailsB[0]]}` });
    assert.equal(actA.status,200); assert.equal(actB.status,200);
    assert.ok(actA.json.every((x:any)=> (x.homeId ?? x.homeID) === homeA));
    assert.ok(actB.json.every((x:any)=> (x.homeId ?? x.homeID) === homeB));

    // Points endpoints show only members of that home
    const ptsA = await json('GET', `/points/${homeA}`, undefined, { Authorization: `Bearer ${tokens[emailsA[0]]}` });
    const ptsB = await json('GET', `/points/${homeB}`, undefined, { Authorization: `Bearer ${tokens[emailsB[0]]}` });
    assert.equal(ptsA.status,200); assert.equal(ptsB.status,200);
    const setA = new Set(ptsA.json.map((p:any)=>p.user_email));
    const setB = new Set(ptsB.json.map((p:any)=>p.user_email));
    for (const e of emailsA) assert.ok(setA.has(e) && !setB.has(e));
    for (const e of emailsB) assert.ok(setB.has(e) && !setA.has(e));
  });
});
