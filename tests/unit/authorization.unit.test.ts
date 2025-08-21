import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the db used by authorization middleware
type State = {
  user_homes: Array<{ user_email: string; home_id: string }>;
  chores: Map<string, { uuid: string; home_id: string }>;
  disputes: Map<string, { uuid: string; chore_id: string }>;
  throwOnQuery?: boolean;
};

const state: State = {
  user_homes: [],
  chores: new Map(),
  disputes: new Map(),
  throwOnQuery: false,
};

vi.mock('../../src/db/models', () => {
  const db = (table: string) => ({
    where: (criteria: any) => ({
      async first() {
        if (state.throwOnQuery) throw new Error('db fail');
        if (table === 'user_homes') {
          const hit = state.user_homes.find(
            (r) => r.user_email === criteria.user_email && r.home_id === criteria.home_id
          );
          return hit ? { ...hit } : undefined;
        }
        if (table === 'chores') {
          return state.chores.get(criteria.uuid);
        }
        if (table === 'disputes') {
          return state.disputes.get(criteria.uuid);
        }
        return undefined;
      },
    }),
  });
  return { db };
});

import {
  requireHomeMemberByParam,
  requireHomeMemberByQuery,
  requireSelfEmailByQuery,
  requireSelfEmailByBody,
  requireSelfEmailByParam,
  requireHomeMemberByChoreUuidParam,
  requireHomeMemberByDisputeUuidParam,
  requireHomeMemberByChoreUuidBody,
} from '../../src/middleware/authorization';

const setUser = (email?: string) => (req: any, _res: any, next: any) => {
  if (email) req.user = { email };
  next();
};

beforeEach(() => {
  state.user_homes = [];
  state.chores = new Map();
  state.disputes = new Map();
  state.throwOnQuery = false;
});

describe('authorization middleware', () => {
  it('rejects unauthenticated users when checking home membership via URL parameter', async () => {
    const app = express();
    app.get('/x/:homeId', requireHomeMemberByParam('homeId'), (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/x/h1');
    expect(res.status).toBe(401);
  });

  it('rejects requests missing home ID parameter', async () => {
    const app = express();
    app.get('/x', setUser('a@b.com'), requireHomeMemberByParam('homeId'), (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/x');
    expect(res.status).toBe(400);
  });

  it('rejects non-members when checking home membership via URL parameter', async () => {
    const app = express();
    app.get('/x/:homeId', setUser('a@b.com'), requireHomeMemberByParam('homeId'), (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/x/h1');
    expect(res.status).toBe(403);
  });

  it('allows home members when checking membership via URL parameter', async () => {
    state.user_homes.push({ user_email: 'a@b.com', home_id: 'h1' });
    const app = express();
    app.get('/x/:homeId', setUser('a@b.com'), requireHomeMemberByParam('homeId'), (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/x/h1');
    expect(res.status).toBe(200);
  });

  it('handles home membership checks via query parameters', async () => {
    const app = express();
    app.get('/q', setUser('a@b.com'), requireHomeMemberByQuery('homeId'), (_req, res) => res.json({ ok: true }));
    let res = await request(app).get('/q');
    expect(res.status).toBe(400);
    state.user_homes.push({ user_email: 'a@b.com', home_id: 'h1' });
    res = await request(app).get('/q?homeId=h1');
    expect(res.status).toBe(200);
  });

  it('enforces self-access restrictions via query parameters', async () => {
    const app = express();
    app.get('/me', requireSelfEmailByQuery('email'), (_req, res) => res.json({ ok: true }));
    let res = await request(app).get('/me');
    expect(res.status).toBe(401);
    const app2 = express();
    app2.get('/me', setUser('a@b.com'), requireSelfEmailByQuery('email'), (_req, res) => res.json({ ok: true }));
    res = await request(app2).get('/me');
    expect(res.status).toBe(400);
    res = await request(app2).get('/me?email=other@b.com');
    expect(res.status).toBe(403);
    res = await request(app2).get('/me?email=a@b.com');
    expect(res.status).toBe(200);
  });

  it('enforces self-access restrictions via request body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/me', requireSelfEmailByBody('email'), (_req, res) => res.json({ ok: true }));
    let res = await request(app).post('/me').send({});
    expect(res.status).toBe(401);
    const app2 = express();
    app2.use(express.json());
    app2.post('/me', setUser('a@b.com'), requireSelfEmailByBody('email'), (_req, res) => res.json({ ok: true }));
    res = await request(app2).post('/me').send({});
    expect(res.status).toBe(400);
    res = await request(app2).post('/me').send({ email: 'other@b.com' });
    expect(res.status).toBe(403);
    res = await request(app2).post('/me').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
  });

  it('enforces self-access restrictions via URL parameters', async () => {
    const app = express();
    app.get('/me', requireSelfEmailByParam('email'), (_req, res) => res.json({ ok: true }));
    let res = await request(app).get('/me');
    expect(res.status).toBe(401);
    const app2 = express();
    app2.get('/me', setUser('a@b.com'), requireSelfEmailByParam('email'), (_req, res) => res.json({ ok: true }));
    app2.get('/me/:email', setUser('a@b.com'), requireSelfEmailByParam('email'), (_req, res) => res.json({ ok: true }));
    res = await request(app2).get('/me');
    expect(res.status).toBe(400);
    res = await request(app2).get('/me/other@b.com');
    expect(res.status).toBe(403);
    res = await request(app2).get('/me/a@b.com');
    expect(res.status).toBe(200);
  });

  it('enforces home membership for chore access via chore UUID', async () => {
    const app = express();
    app.get('/c/:uuid', setUser('a@b.com'), requireHomeMemberByChoreUuidParam('uuid'), (_req, res) => res.json({ ok: true }));
    let res = await request(app).get('/c/does-not-exist');
    expect(res.status).toBe(404);
    state.chores.set('c1', { uuid: 'c1', home_id: 'h1' });
    res = await request(app).get('/c/c1');
    expect(res.status).toBe(403);
    state.user_homes.push({ user_email: 'a@b.com', home_id: 'h1' });
    res = await request(app).get('/c/c1');
    expect(res.status).toBe(200);
  });

  it('enforces home membership for dispute access via dispute UUID', async () => {
    const app = express();
    app.get('/d/:uuid', setUser('a@b.com'), requireHomeMemberByDisputeUuidParam('uuid'), (_req, res) => res.json({ ok: true }));
    let res = await request(app).get('/d/missing');
    expect(res.status).toBe(404);
    state.disputes.set('d1', { uuid: 'd1', chore_id: 'c1' });
    res = await request(app).get('/d/d1');
    expect(res.status).toBe(404); // chore not found
    state.chores.set('c1', { uuid: 'c1', home_id: 'h1' });
    state.user_homes.push({ user_email: 'a@b.com', home_id: 'h1' });
    res = await request(app).get('/d/d1');
    expect(res.status).toBe(200);
  });

  it('enforces home membership for chore access via chore ID in request body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/cb', setUser('a@b.com'), requireHomeMemberByChoreUuidBody('chore_id'), (_req, res) => res.json({ ok: true }));
    let res = await request(app).post('/cb').send({});
    expect(res.status).toBe(400);
    res = await request(app).post('/cb').send({ chore_id: 'c1' });
    expect(res.status).toBe(404);
    state.chores.set('c1', { uuid: 'c1', home_id: 'h1' });
    res = await request(app).post('/cb').send({ chore_id: 'c1' });
    expect(res.status).toBe(403);
    state.user_homes.push({ user_email: 'a@b.com', home_id: 'h1' });
    res = await request(app).post('/cb').send({ chore_id: 'c1' });
    expect(res.status).toBe(200);
  });
});


