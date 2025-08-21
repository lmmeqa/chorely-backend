import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DisputeTimeoutService } from '../../src/services/disputeTimeoutService';

type Dispute = { uuid: string; chore_id: string; status: 'pending' | 'overruled' | 'sustained'; created_at: string };
type Chore = { uuid: string; home_id: string; user_email?: string };
type UserHome = { user_email: string; home_id: string };
type DisputeVote = { dispute_uuid: string; vote: 'sustain' | 'overrule' };

const state = {
  disputes: [] as Dispute[],
  chores: new Map<string, Chore>(),
  user_homes: [] as UserHome[],
  dispute_votes: [] as DisputeVote[],
  updates: [] as Array<{ uuid: string; update: any }>,
};

vi.mock('../../src/db/models', () => {
  const db: any = (table: string) => ({
    where(criteria: any) {
      if (table === 'disputes') {
        if (criteria.status) {
          const rows = state.disputes.filter(d => d.status === criteria.status);
          return {
            orderBy(_col: string, _dir: string) {
              return rows;
            }
          } as any;
        }
        if (criteria.uuid) {
          return {
            async update(update: any) {
              state.updates.push({ uuid: criteria.uuid, update });
              const idx = state.disputes.findIndex(d => d.uuid === criteria.uuid);
              if (idx >= 0) state.disputes[idx] = { ...state.disputes[idx], ...update };
              return 1;
            }
          } as any;
        }
      }
      if (table === 'chores') {
        return {
          async first() {
            const c = state.chores.get(criteria.uuid);
            return c ? { ...c } : undefined;
          }
        } as any;
      }
      if (table === 'user_homes') {
        return state.user_homes.filter(u => u.home_id === criteria.home_id);
      }
      if (table === 'dispute_votes') {
        return state.dispute_votes.filter(v => v.dispute_uuid === criteria.dispute_uuid);
      }
      return [] as any;
    }
  });
  db.fn = { now: () => new Date().toISOString() };
  return { db, default: { } };
});

function isoHoursAgo(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

beforeEach(() => {
  state.disputes = [];
  state.chores = new Map();
  state.user_homes = [];
  state.dispute_votes = [];
  state.updates = [];
  vi.useRealTimers();
});

describe('DisputeTimeoutService', () => {
  it('overrules disputes that are >= 24 hours old', async () => {
    const oldId = 'd-old';
    const freshId = 'd-fresh';
    state.disputes.push(
      { uuid: oldId, chore_id: 'c1', status: 'pending', created_at: isoHoursAgo(24) },
      { uuid: freshId, chore_id: 'c1', status: 'pending', created_at: isoHoursAgo(12) }
    );
    state.chores.set('c1', { uuid: 'c1', home_id: 'h1', user_email: 'claimer@home' });
    state.user_homes.push({ user_email: 'claimer@home', home_id: 'h1' }, { user_email: 'other@home', home_id: 'h1' });

    await DisputeTimeoutService.checkTimeoutDisputes();

    const updatedOld = state.disputes.find(d => d.uuid === oldId)!;
    const updatedFresh = state.disputes.find(d => d.uuid === freshId)!;
    expect(updatedOld.status).toBe('overruled');
    expect(updatedFresh.status).toBe('pending');
  });

  it('skips disputes whose chore is missing', async () => {
    state.disputes.push({ uuid: 'd1', chore_id: 'missing', status: 'pending', created_at: isoHoursAgo(36) });

    await DisputeTimeoutService.checkTimeoutDisputes();

    expect(state.updates.length).toBe(0);
    expect(state.disputes[0].status).toBe('pending');
  });

  it('handles multiple disputes with mixed ages', async () => {
    state.disputes.push(
      { uuid: 'd1', chore_id: 'c1', status: 'pending', created_at: isoHoursAgo(30) },
      { uuid: 'd2', chore_id: 'c1', status: 'pending', created_at: isoHoursAgo(10) },
      { uuid: 'd3', chore_id: 'c1', status: 'pending', created_at: isoHoursAgo(50) }
    );
    state.chores.set('c1', { uuid: 'c1', home_id: 'h1', user_email: 'x@h' });

    await DisputeTimeoutService.checkTimeoutDisputes();

    expect(state.disputes.find(d => d.uuid === 'd1')!.status).toBe('overruled');
    expect(state.disputes.find(d => d.uuid === 'd2')!.status).toBe('pending');
    expect(state.disputes.find(d => d.uuid === 'd3')!.status).toBe('overruled');
  });

  it('startTimeoutService clears existing interval and triggers immediate check', async () => {
    const spy = vi.spyOn(DisputeTimeoutService, 'checkTimeoutDisputes').mockResolvedValue();
    // start first time
    DisputeTimeoutService.startTimeoutService();
    // start again should clear previous
    DisputeTimeoutService.startTimeoutService();
    expect(spy).toHaveBeenCalled();
    DisputeTimeoutService.stopTimeoutService();
    spy.mockRestore();
  });
});


