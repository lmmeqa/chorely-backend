import { ModelError } from '../lib/ModelError';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuidParam(name: string) {
  return async (c: any, next: any) => {
    const v = c.req.param(name);
    if (!UUID_RE.test(v)) throw new ModelError('BAD_REQUEST', `${name} must be uuid`, 400);
    return next();
  };
}

export function ensureFound(row: any, what = 'resource') {
  if (!row) throw new ModelError('NOT_FOUND', `${what} not found`, 404);
  return row;
}
