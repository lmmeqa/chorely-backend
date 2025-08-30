export function isUuidLoose(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function requireUuidParam(c: any, paramName: string): string | null {
  const v = c.req.param(paramName);
  if (!isUuidLoose(v)) {
    c.status(400);
    c.header('Content-Type','application/json');
    c.body = JSON.stringify({ error: `${paramName} must be UUID` });
    return null;
  }
  return v;
}

export function ensureFound<T>(c: any, row: T | undefined | null, what = 'resource'): T | null {
  if (!row) {
    c.status(404);
    c.header('Content-Type','application/json');
    c.body = JSON.stringify({ error: `${what} not found` });
    return null;
  }
  return row;
}
