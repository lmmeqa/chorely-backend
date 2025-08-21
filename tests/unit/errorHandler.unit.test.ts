import express, { RequestHandler } from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler';
import { ModelError } from '../../src/db/models/ModelError';

const route = (handler: RequestHandler) => {
  const app = express();
  app.get('/t', handler);
  app.use(errorHandler);
  return app;
};

describe('errorHandler middleware', () => {
  it('formats custom ModelError responses with correct status and structure', async () => {
    const app = route((_req, _res, next) => next(new ModelError('TEST', 'bad', 409)));
    const res = await request(app).get('/t');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'bad', code: 'TEST' });
  });

  it('maps unexpected errors to generic 500 server error', async () => {
    const app = route((_req, _res, next) => next(new Error('boom')));
    const res = await request(app).get('/t');
    expect(res.status).toBe(500);
    expect(res.body?.code).toBe('SERVER_ERROR');
  });
});


