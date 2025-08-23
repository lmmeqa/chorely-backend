import { Hono } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------- Test State & DB Mock ----------

type State = {
  user_homes: Array<{ user_email: string; home_id: string }>;
  chores: Map<string, { uuid: string; homeId: string }>;
  disputes: Map<string, { uuid: string; choreId: string }>;
  throwOnQuery: boolean;
};

// Mock Drizzle schema imports
vi.mock('../../src/db/schema', () => ({
  userHomes: { 
    name: 'user_homes',
    userEmail: 'userEmail',
    homeId: 'homeId'
  },
  chores: { 
    name: 'chores',
    uuid: 'uuid',
    homeId: 'homeId'
  },
  disputes: { 
    name: 'disputes',
    uuid: 'uuid',
    choreId: 'choreId'
  },
}));

// Mock Drizzle ORM functions
vi.mock('drizzle-orm', () => ({
  and: (...conditions: any[]) => ({ conditions }),
  eq: (column: any, value: any) => ({ column: column.name || column, value }),
}));

const state: State = {
  user_homes: [],
  chores: new Map(),
  disputes: new Map(),
  throwOnQuery: false,
};

// Mock for Hono authorization that uses Drizzle ORM
vi.mock('../../src/lib/db', () => {
  return {
    dbFromEnv: () => ({
      select: () => ({
        from: (table: any) => {
          // Get table name from Drizzle table object
          const tableName = table?.name?.toLowerCase() || '';
          
          return {
            where: (condition: any) => ({
              limit: (n?: number) => {
                if (state.throwOnQuery) {
                  return Promise.reject(new Error('db fail'));
                }
                
                // Handle different table queries
                if (tableName.includes('user_homes') || tableName.includes('userhomes')) {
                  // Extract conditions from Drizzle 'and' and 'eq' functions
                  let userEmail: string | undefined;
                  let homeId: string | undefined;
                  
                  // Handle both direct conditions and 'and' conditions
                  if (condition && typeof condition === 'object') {
                    // Look for eq conditions in the condition object
                    if (condition.userEmail) userEmail = condition.userEmail;
                    if (condition.homeId) homeId = condition.homeId;
                    
                    // Also check for nested conditions (from 'and' function)
                    if (condition.conditions) {
                      condition.conditions.forEach((c: any) => {
                        if (c.column === 'userEmail') userEmail = c.value;
                        if (c.column === 'homeId') homeId = c.value;
                      });
                    }
                  }
                  
                  const match = state.user_homes.find(
                    (r: any) => r.user_email === userEmail && r.home_id === homeId
                  );
                  return Promise.resolve(match ? [match] : []);
                }
                
                if (tableName.includes('chore')) {
                  // Find matching chore by UUID
                  let uuid: string | undefined;
                  
                  if (condition && typeof condition === 'object') {
                    if (condition.uuid) uuid = condition.uuid;
                    if (condition.column === 'uuid') uuid = condition.value;
                  }
                  
                  const chore = uuid ? state.chores.get(uuid) : undefined;
                  return Promise.resolve(chore ? [chore] : []);
                }
                
                if (tableName.includes('dispute')) {
                  // Find matching dispute by UUID
                  let uuid: string | undefined;
                  
                  if (condition && typeof condition === 'object') {
                    if (condition.uuid) uuid = condition.uuid;
                    if (condition.column === 'uuid') uuid = condition.value;
                  }
                  
                  const dispute = uuid ? state.disputes.get(uuid) : undefined;
                  return Promise.resolve(dispute ? [dispute] : []);
                }
                
                return Promise.resolve([]);
              }
            })
          };
        }
      })
    })
  };
});

// ---------- Imports AFTER mocks ----------
import {
  requireHomeMemberByParam,
  requireHomeMemberByQuery,
  requireHomeMemberByChoreUuid,
  requireSelfEmailByParam,
} from '../../src/lib/authorization';

// ---------- Test Helpers ----------
function makeApp() {
  return new Hono();
}

async function req(
  app: Hono,
  method: string,
  url: string,
  opts?: { email?: string; body?: any }
) {
  const headers: Record<string, string> = {};
  if (opts?.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  // our setUser helper reads this header to seed c.get('user')
  if (opts?.email) headers['x-test-user'] = opts.email;

  return app.request(url, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

const setUser = (emailHeader = 'x-test-user') => async (c: any, next: any) => {
  const email = c.req.header(emailHeader);
  if (email) {
    c.set('user', { email });
  }
  return next();
};

beforeEach(() => {
  state.user_homes = [];
  state.chores = new Map();
  state.disputes = new Map();
  state.throwOnQuery = false;
});

// ---------- Tests ----------

describe('authorization middleware (Hono)', () => {
  describe('requireHomeMemberByParam', () => {
    it('401 unauthenticated', async () => {
      const app = makeApp();
      app.get('/x/:homeId', requireHomeMemberByParam('homeId'), (c) => c.json({ ok: true }));
      const res = await req(app, 'GET', '/x/h1');
      expect(res.status).toBe(401);
    });

    it('400 missing param', async () => {
      const app = makeApp();
      app.get('/x', setUser(), requireHomeMemberByParam('homeId'), (c) => c.json({ ok: true }));
      const res = await req(app, 'GET', '/x', { email: 'a@b.com' });
      expect(res.status).toBe(400);
    });

    it('403 non-member', async () => {
      const app = makeApp();
      app.get('/x/:homeId', setUser(), requireHomeMemberByParam('homeId'), (c) => c.json({ ok: true }));
      const res = await req(app, 'GET', '/x/h1', { email: 'a@b.com' });
      expect(res.status).toBe(403);
    });

    it('200 member', async () => {
      state.user_homes.push({ user_email: 'a@b.com', home_id: 'h1' });
      const app = makeApp();
      app.get('/x/:homeId', setUser(), requireHomeMemberByParam('homeId'), (c) => c.json({ ok: true }));
      const res = await req(app, 'GET', '/x/h1', { email: 'a@b.com' });
      expect(res.status).toBe(200);
    });
  });

  describe('requireHomeMemberByQuery', () => {
    it('401 unauthenticated', async () => {
      const app = makeApp();
      app.get('/x', requireHomeMemberByQuery('homeId'), (c) => c.json({ ok: true }));
      const res = await req(app, 'GET', '/x?homeId=h1');
      expect(res.status).toBe(401);
    });

    it('400 missing query param', async () => {
      const app = makeApp();
      app.get('/x', setUser(), requireHomeMemberByQuery('homeId'), (c) => c.json({ ok: true }));
      const res = await req(app, 'GET', '/x', { email: 'a@b.com' });
      expect(res.status).toBe(400);
    });

    it('403 non-member', async () => {
      const app = makeApp();
      app.get('/x', setUser(), requireHomeMemberByQuery('homeId'), (c) => c.json({ ok: true }));
      const res = await req(app, 'GET', '/x?homeId=h1', { email: 'a@b.com' });
      expect(res.status).toBe(403);
    });

    it('200 member', async () => {
      state.user_homes.push({ user_email: 'a@b.com', home_id: 'h1' });
      const app = makeApp();
      app.get('/x', setUser(), requireHomeMemberByQuery('homeId'), (c) => c.json({ ok: true }));
      const res = await req(app, 'GET', '/x?homeId=h1', { email: 'a@b.com' });
      expect(res.status).toBe(200);
    });
  });

  describe('self email checks', () => {
    it('requireSelfEmailByParam', async () => {
      const app = makeApp();
      app.get('/me/:email', setUser(), requireSelfEmailByParam('email'), (c) => c.json({ ok: true }));

      let res = await req(app, 'GET', '/me/a@b.com'); // missing
      expect(res.status).toBe(401);

      res = await req(app, 'GET', '/me/a@b.com', { email: 'other@b.com' });
      expect(res.status).toBe(403);

      res = await req(app, 'GET', '/me/a@b.com', { email: 'a@b.com' });
      expect(res.status).toBe(200);
    });
  });

  describe('chore membership via UUID params', () => {
    it('chore uuid -> home member check', async () => {
      const app = makeApp();
      app.get(
        '/chore/:uuid',
        setUser(),
        requireHomeMemberByChoreUuid('uuid'),
        (c) => c.json({ ok: true })
      );

      // chore not found
      let res = await req(app, 'GET', '/chore/c1', { email: 'a@b.com' });
      expect(res.status).toBe(404);

      // chore exists but user not a member of its home
      state.chores.set('c1', { uuid: 'c1', homeId: 'h1' });
      res = await req(app, 'GET', '/chore/c1', { email: 'a@b.com' });
      expect(res.status).toBe(403);

      // user is member
      state.user_homes.push({ user_email: 'a@b.com', home_id: 'h1' });
      res = await req(app, 'GET', '/chore/c1', { email: 'a@b.com' });
      expect(res.status).toBe(200);
    });
  });

  // NOTE: Dispute UUID validation is not implemented in the Hono version
  // This would need to be added to src/lib/authorization.ts if needed
  describe.skip('dispute membership via UUID params', () => {
    it('dispute uuid -> home member check', async () => {
      // TODO: Implement when function is added to Hono authorization
    });
  });

  describe('database error handling', () => {
    it('returns 500 when database layer throws', async () => {
      const app = makeApp();
      app.get('/x/:homeId', setUser(), requireHomeMemberByParam('homeId'), (c) => c.json({ ok: true }));
      state.throwOnQuery = true;

      const res = await req(app, 'GET', '/x/h1', { email: 'a@b.com' });
      expect(res.status).toBe(500);
    });
  });
});