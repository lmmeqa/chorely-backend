import assert from 'node:assert/strict';

export function expectApprovalVotePayload(p: any) {
  assert.ok(p && typeof p === 'object', 'payload must be an object');
  assert.ok(typeof p.choreUuid === 'string');
  assert.ok(typeof p.approved === 'boolean');
  assert.ok(p.counts && Number.isInteger(p.counts.approve));
  assert.ok(Number.isInteger(p.counts.totalMembers));
  assert.ok(p.myVote === 'approve' || p.myVote === null);
}

export function expectDisputeVotePayload(p: any) {
  assert.ok(p && typeof p === 'object');
  assert.ok(typeof p.disputeUuid === 'string');
  assert.ok(typeof p.resolved === 'boolean');
  assert.ok(['sustain','overrule',null].includes(p.resolution));
  assert.ok(p.counts && Number.isInteger(p.counts.sustain));
  assert.ok(Number.isInteger(p.counts.overrule));
  assert.ok(Number.isInteger(p.counts.totalMembers));
}

export function expectStatusChangedEvent(e: any) {
  // { id, ts:number, type:'STATUS_CHANGED', actor:{email,name?}, homeId, choreUuid, newStatus }
  assert.equal(e.type, 'STATUS_CHANGED');
  assert.ok(typeof e.ts === 'number');
  assert.ok(typeof e.id === 'string');
  assert.ok(e.actor && typeof e.actor.email === 'string');
  assert.ok(typeof e.homeId === 'string');
  assert.ok(typeof e.choreUuid === 'string');
  assert.ok(['UNCLAIMED','CLAIMED','COMPLETED'].includes(e.newStatus));
}