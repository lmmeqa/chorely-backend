import { Request, Response, NextFunction } from 'express';
import { db } from '../db/models';
import { AuthenticatedRequest } from './supabaseAuth';

async function isUserMemberOfHome(userEmail: string, homeId: string): Promise<boolean> {
	if (!userEmail || !homeId) return false;
	const row = await db('user_homes')
		.where({ user_email: userEmail, home_id: homeId })
		.first();
	return !!row;
}

export function requireHomeMemberByParam(paramName: string) {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
	return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		const email = req.user?.email;
		const requested = String((req.query as any)[queryName] || '').toLowerCase();
		if (!email) return res.status(401).json({ error: 'Unauthorized' });
		if (!requested) return res.status(400).json({ error: `Missing query ${queryName}` });
		if (email !== requested) return res.status(403).json({ error: 'Forbidden: cannot access other user data' });
		return next();
	};
}

export function requireSelfEmailByBody(bodyKey: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const email = req.user?.email;
        const requested = String((req.body || {})[bodyKey] || '').toLowerCase();
        if (!email) return res.status(401).json({ error: 'Unauthorized' });
        if (!requested) return res.status(400).json({ error: `Missing body field ${bodyKey}` });
        if (email !== requested) return res.status(403).json({ error: 'Forbidden: cannot act as another user' });
        return next();
    };
}

export function requireSelfEmailByParam(paramName: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const email = req.user?.email;
        const requested = String((req.params || {})[paramName] || '').toLowerCase();
        if (!email) return res.status(401).json({ error: 'Unauthorized' });
        if (!requested) return res.status(400).json({ error: `Missing param ${paramName}` });
        if (email !== requested) return res.status(403).json({ error: 'Forbidden: cannot access other user data' });
        return next();
    };
}

export function requireHomeMemberByChoreUuidParam(paramName: string) {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
