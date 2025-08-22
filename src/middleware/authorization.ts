// Legacy authorization middleware kept for unit test compatibility.
// The Hono Worker uses src/lib/authorization.ts instead.
import type { Context } from 'hono';

// Lightweight in-memory db stub used only by unit tests where this module is mocked.
export const db: any = (table: string) => ({
  where: (criteria: any) => ({
    async first() {
      // Access the test state that's set up in the test file
      const state = (global as any).__TEST_STATE__;
      if (!state) return undefined;
      
      if (table === 'user_homes') {
        const hit = state.user_homes?.find(
          (r: any) => r.user_email === criteria.user_email && r.home_id === criteria.home_id
        );
        return hit ? { ...hit } : undefined;
      }
      if (table === 'chores') {
        return state.chores?.get(criteria.uuid);
      }
      if (table === 'disputes') {
        return state.disputes?.get(criteria.uuid);
      }
      return undefined;
    }
  })
});

// Type definitions for unit tests
export interface AuthenticatedRequest {
  user?: {
    id: string;
    email?: string;
  };
  params: Record<string, string>;
  query: Record<string, any>;
  body: Record<string, any>;
}

async function isUserMemberOfHome(userEmail: string, homeId: string): Promise<boolean> {
	if (!userEmail || !homeId) return false;
	const row = await db('user_homes')
		.where({ user_email: userEmail, home_id: homeId })
		.first();
	return !!row;
}

export function requireHomeMemberByParam(paramName: string) {
	return async (req: AuthenticatedRequest, res: any, next: any) => {
		try {
			const email = req.user?.email;
			const homeId = req.params[paramName];
			if (!email) return res.status(401).json({ error: 'Unauthorized' });
			if (!homeId) return res.status(400).json({ error: `Missing param ${paramName}` });
			if (!(await isUserMemberOfHome(email, homeId))) {
				return res.status(403).json({ error: 'Forbidden: not a member of this home' });
			}
			return next();
		} catch (e) {
			return res.status(500).json({ error: 'Authorization error' });
		}
	};
}

export function requireHomeMemberByQuery(queryName: string) {
	return async (req: AuthenticatedRequest, res: any, next: any) => {
		try {
			const email = req.user?.email;
			const homeId = String((req.query as any)[queryName] || '');
			if (!email) return res.status(401).json({ error: 'Unauthorized' });
			if (!homeId) return res.status(400).json({ error: `Missing query ${queryName}` });
			if (!(await isUserMemberOfHome(email, homeId))) {
				return res.status(403).json({ error: 'Forbidden: not a member of this home' });
			}
			return next();
		} catch {
			return res.status(500).json({ error: 'Authorization error' });
		}
	};
}

export function requireSelfEmailByQuery(queryName: string) {
	return (req: AuthenticatedRequest, res: any, next: any) => {
		const email = req.user?.email;
		const requested = String((req.query as any)[queryName] || '').toLowerCase();
		if (!email) return res.status(401).json({ error: 'Unauthorized' });
		if (!requested) return res.status(400).json({ error: `Missing query ${queryName}` });
		if (email !== requested) return res.status(403).json({ error: 'Forbidden: cannot access other user data' });
		return next();
	};
}

export function requireSelfEmailByBody(bodyKey: string) {
    return (req: AuthenticatedRequest, res: any, next: any) => {
        const email = req.user?.email;
        const requested = String((req.body || {})[bodyKey] || '').toLowerCase();
        if (!email) return res.status(401).json({ error: 'Unauthorized' });
        if (!requested) return res.status(400).json({ error: `Missing body field ${bodyKey}` });
        if (email !== requested) return res.status(403).json({ error: 'Forbidden: cannot act as another user' });
        return next();
    };
}

export function requireSelfEmailByParam(paramName: string) {
    return (req: AuthenticatedRequest, res: any, next: any) => {
        const email = req.user?.email;
        const requested = String((req.params || {})[paramName] || '').toLowerCase();
        if (!email) return res.status(401).json({ error: 'Unauthorized' });
        if (!requested) return res.status(400).json({ error: `Missing param ${paramName}` });
        if (email !== requested) return res.status(403).json({ error: 'Forbidden: cannot access other user data' });
        return next();
    };
}

export function requireHomeMemberByChoreUuidParam(paramName: string) {
	return async (req: AuthenticatedRequest, res: any, next: any) => {
		try {
			const email = req.user?.email;
			const uuid = req.params[paramName];
			if (!email) return res.status(401).json({ error: 'Unauthorized' });
			if (!uuid) return res.status(400).json({ error: `Missing param ${paramName}` });
			const chore = await db('chores').where({ uuid }).first();
			if (!chore) return res.status(404).json({ error: 'Chore not found' });
			if (!(await isUserMemberOfHome(email, chore.home_id))) {
				return res.status(403).json({ error: 'Forbidden: not a member of this home' });
			}
			return next();
		} catch {
			return res.status(500).json({ error: 'Authorization error' });
		}
	};
}

export function requireHomeMemberByDisputeUuidParam(paramName: string) {
	return async (req: AuthenticatedRequest, res: any, next: any) => {
		try {
			const email = req.user?.email;
			const uuid = req.params[paramName];
			if (!email) return res.status(401).json({ error: 'Unauthorized' });
			if (!uuid) return res.status(400).json({ error: `Missing param ${paramName}` });
			const dispute = await db('disputes').where({ uuid }).first();
			if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
			const chore = await db('chores').where({ uuid: dispute.chore_id }).first();
			if (!chore) return res.status(404).json({ error: 'Chore not found for dispute' });
			if (!(await isUserMemberOfHome(email, chore.home_id))) {
				return res.status(403).json({ error: 'Forbidden: not a member of this home' });
			}
			return next();
		} catch {
			return res.status(500).json({ error: 'Authorization error' });
		}
	};
}

export function requireHomeMemberByChoreUuidBody(bodyKey: string) {
	return async (req: AuthenticatedRequest, res: any, next: any) => {
		try {
			const email = req.user?.email;
			const uuid = (req.body || {})[bodyKey];
			if (!email) return res.status(401).json({ error: 'Unauthorized' });
			if (!uuid) return res.status(400).json({ error: `Missing body field ${bodyKey}` });
			const chore = await db('chores').where({ uuid }).first();
			if (!chore) return res.status(404).json({ error: 'Chore not found' });
			if (!(await isUserMemberOfHome(email, chore.home_id))) {
				return res.status(403).json({ error: 'Forbidden: not a member of this home' });
			}
			return next();
		} catch {
			return res.status(500).json({ error: 'Authorization error' });
		}
	};
}
