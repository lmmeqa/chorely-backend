import express, { RequestHandler } from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler';

const route = (handler: RequestHandler) => {
  const app = express();
  app.get('/t', handler);
  app.use(errorHandler);
  return app;
};

describe('errorHandler middleware (extended)', () => {
  it('handles unknown error objects with 500', async () => {
    const app = route((_req, _res, next) => next({} as any));
    const res = await request(app).get('/t');
    expect(res.status).toBe(500);
    expect(res.body?.code).toBe('SERVER_ERROR');
  });

  it('includes error string message when present', async () => {
    const app = route((_req, _res, next) => next(new Error('oops')));
    const res = await request(app).get('/t');
    expect(res.status).toBe(500);
    expect(String(res.body?.error).toLowerCase()).toContain('oops');
  });
});


