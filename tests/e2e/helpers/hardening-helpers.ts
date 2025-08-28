import assert from 'node:assert/strict';
import { json, agent } from '../../helpers/hono-test-client';
import { supabaseSignupOrLogin } from './supabase';
import { createOrJoinUser } from './users';

export function jpegB64() { 
  return Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64'); 
}

export async function setupHomeWithUsers(emails: string[]) {
  const tokens: Record<string,string> = {};
  for (const e of emails) tokens[e] = await supabaseSignupOrLogin(e, 'password123');
  const h = await json('POST','/homes',{ name: `Home ${Math.random().toString(36).slice(2,7)}` });
  assert.equal(h.status, 201);
  const homeId = h.json.id;
  for (const e of emails) {
    // name = localpart before @
    await createOrJoinUser(agent as any, e, e.split('@')[0], homeId);
  }
  return { homeId, tokens } as const;
}

export async function createChore(homeId: string, token: string, opts: { name?: string; points?: number; time?: string } = {}) {
  const body = {
    home_id: homeId,
    name: opts.name ?? `Chore ${Math.random().toString(36).slice(2,6)}`,
    time: opts.time ?? new Date().toISOString(),
    points: opts.points ?? 1,
  };
  const r = await json('POST','/chores', body, { Authorization: `Bearer ${token}`});
  assert.equal(r.status, 201);
  return r.json; // { uuid, ... }
}

export async function claimThenComplete(choreUuid: string, token: string, jpegBase64?: string) {
  const claim = await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${token}` });
  assert.ok([204,409].includes(claim.status));
  const complete = await json('PATCH', `/chores/${choreUuid}/complete`,
    jpegBase64 ? { image: { data: jpegBase64, filename: 'p.jpg', contentType: 'image/jpeg' } } : {},
    { Authorization: `Bearer ${token}`}
  );
  assert.ok([204,409].includes(complete.status));
  return { claim, complete };
}

export async function approveClaimThenComplete(choreUuid: string, token: string, jpegBase64?: string) {
  // First approve the chore if not already approved
  const approve = await agent.patch(`/chores/${choreUuid}/approve`).set({ Authorization: `Bearer ${token}` });
  assert.ok([204,409].includes(approve.status)); // 204 = approved, 409 = already approved or claimed
  
  const claim = await agent.patch(`/chores/${choreUuid}/claim`).set({ Authorization: `Bearer ${token}` });
  assert.ok([204,409].includes(claim.status));
  const complete = await json('PATCH', `/chores/${choreUuid}/complete`,
    jpegBase64 ? { image: { data: jpegBase64, filename: 'p.jpg', contentType: 'image/jpeg' } } : {},
    { Authorization: `Bearer ${token}`}
  );
  assert.ok([204,409].includes(complete.status));
  return { approve, claim, complete };
}

export async function addUserToHome(homeId: string, email: string) {
  const token = await supabaseSignupOrLogin(email, 'password123');
  await createOrJoinUser(agent as any, email, email.split('@')[0], homeId);
  return { email, token } as const;
}

// Quick flows used by activity/event assertions
export async function quickDisputeThatAutoSustains(homeId: string, tokens: Record<string,string>, completer: string, opener: string, others: string[], choreUuid?: string) {
  const jpeg = jpegB64();
  const uuid = choreUuid ?? (await createChore(homeId, tokens[completer], { points: 2 })).uuid;
  await approveClaimThenComplete(uuid, tokens[completer], jpeg);
  const d = await json('POST','/disputes', { choreId: uuid, reason: 'auto-sustain' }, { Authorization:`Bearer ${tokens[opener]}`});
  assert.equal(d.status, 201);
  // opener auto-sustain; get to strict majority using others[0], others[1], ...
  for (const e of others) {
    const r = await json('POST', `/dispute-votes/${d.json.uuid}/vote`, { sustain: true }, { Authorization:`Bearer ${tokens[e]}`});
    assert.equal(r.status, 204);
    // Stop once backend has closed it (subsequent loop iters can early‑exit if GET shows closed)
    const g = await json('GET', `/disputes/${d.json.uuid}`);
    if (g.json.status !== 'pending') break;
  }
  return { disputeUuid: d.json.uuid, choreUuid: uuid, homeId } as const;
}

export async function quickDisputeThatAutoOverrules(homeId: string, tokens: Record<string,string>, completer: string, opener: string, overruleVoters: string[], choreUuid?: string) {
  const jpeg = jpegB64();
  const uuid = choreUuid ?? (await createChore(homeId, tokens[completer], { points: 2 })).uuid;
  await approveClaimThenComplete(uuid, tokens[completer], jpeg);
  const d = await json('POST','/disputes', { choreId: uuid, reason: 'auto-overrule' }, { Authorization:`Bearer ${tokens[opener]}`});
  assert.equal(d.status, 201);
  for (const e of overruleVoters) {
    const r = await json('POST', `/dispute-votes/${d.json.uuid}/vote`, { overrule: true }, { Authorization:`Bearer ${tokens[e]}`});
    assert.equal(r.status, 204);
  }
  return { disputeUuid: d.json.uuid, choreUuid: uuid, homeId } as const;
}
