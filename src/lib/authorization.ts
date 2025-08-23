import { Context, Next } from 'hono';
import { dbFromEnv } from './db';
import { userHomes, chores, disputes } from '../db/schema';
import { and, eq } from 'drizzle-orm';

async function isUserMemberOfHome(db: any, userEmail: string, homeId: string): Promise<boolean> {
  if (!userEmail || !homeId) return false;
  const [row] = await db.select().from(userHomes).where(and(eq(userHomes.userEmail, userEmail), eq(userHomes.homeId, homeId))).limit(1);
  return !!row;
}

export function requireHomeMemberByParam(paramName: string) {
  return async (c: Context, next: Next) => {
    const db = dbFromEnv(c.env as any);
    const u = (c as any).get('user') as { email?: string };
    const homeId = c.req.param(paramName);
    
    if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);
    if (!homeId) return c.json({ error: `Missing param ${paramName}` }, 400);
    
    if (!(await isUserMemberOfHome(db, u.email, homeId))) {
      return c.json({ error: 'Forbidden: not a member of this home' }, 403);
    }
    
    return next();
  };
}

export function requireHomeMemberByQuery(queryName: string) {
  return async (c: Context, next: Next) => {
    const db = dbFromEnv(c.env as any);
    const u = (c as any).get('user') as { email?: string };
    const homeId = c.req.query(queryName);
    
    if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);
    if (!homeId) return c.json({ error: `Missing query ${queryName}` }, 400);
    
    if (!(await isUserMemberOfHome(db, u.email, homeId))) {
      return c.json({ error: 'Forbidden: not a member of this home' }, 403);
    }
    
    return next();
  };
}

export function requireHomeMemberByChoreUuid(paramName: string) {
  return async (c: Context, next: Next) => {
    const db = dbFromEnv(c.env as any);
    const u = (c as any).get('user') as { email?: string };
    const choreUuid = c.req.param(paramName);
    
    if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);
    if (!choreUuid) return c.json({ error: `Missing param ${paramName}` }, 400);
    
    const [chore] = await db.select().from(chores).where(eq(chores.uuid, choreUuid)).limit(1);
    if (!chore) return c.json({ error: 'Chore not found' }, 404);
    
    if (!(await isUserMemberOfHome(db, u.email, chore.homeId))) {
      return c.json({ error: 'Forbidden: not a member of this home' }, 403);
    }
    
    return next();
  };
}

export function requireSelfEmailByParam(paramName: string) {
  return async (c: Context, next: Next) => {
    const u = (c as any).get('user') as { email?: string };
    const emailParam = c.req.param(paramName);
    
    if (!u?.email) return c.json({ error: 'Unauthorized' }, 401);
    if (!emailParam) return c.json({ error: `Missing param ${paramName}` }, 400);
    
    // Ensure the user can only access their own profile
    if (u.email.toLowerCase() !== emailParam.toLowerCase()) {
      return c.json({ error: 'Forbidden: can only access your own profile' }, 403);
    }
    
    return next();
  };
}
