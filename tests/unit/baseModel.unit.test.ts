import { describe, expect, it, vi } from 'vitest';
import { ModelError } from '../../src/db/models/ModelError';

// Mock the db/models index to avoid circular import issues when BaseModel imports ./index
vi.mock('../../src/db/models/index', () => ({ db: {}, default: {} }));

describe('BaseModel utilities', () => {
  let dbGuard: any;
  let mapFk: any;

  beforeAll(async () => {
    // Dynamically import after mock is in place
    const module = await import('../../src/db/models/BaseModel');
    dbGuard = module.dbGuard;
    mapFk = module.mapFk;
  });

  it('preserves existing ModelError instances without modification', async () => {
    const e = new ModelError('X', 'y', 409);
    await expect(dbGuard(async () => { throw e; }, 'op')).rejects.toBe(e);
  });

  it('wraps generic errors with 500 status code', async () => {
    const err = new Error('boom');
    await expect(dbGuard(async () => { throw err; }, 'op')).rejects.toHaveProperty('http', 500);
  });

  it('maps database unique constraint violations to 409 conflict errors', () => {
    const pgErr = { code: '23505', detail: 'Key (email)=(a@b.com) already exists' } as any;
    const m = mapFk(pgErr);
    expect(m).toBeInstanceOf(ModelError);
    expect((m as any).http).toBe(409);
  });
});


