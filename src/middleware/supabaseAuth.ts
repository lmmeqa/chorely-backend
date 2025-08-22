// Legacy middleware kept for unit test compatibility.
// The Hono Worker uses src/lib/auth.ts instead.
import jwt from 'jsonwebtoken';
import type { Context } from 'hono';

export interface AuthenticatedRequest {
	user?: {
		id: string;
		email?: string;
	};
	claims?: any;
	headers: Record<string, string | string[] | undefined>;
	method?: string;
	originalUrl?: string;
}

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET as string | undefined;
if (!SUPABASE_URL) {
	console.error('SUPABASE_URL is required for JWT verification');
}

// No JWKS needed when using HS256 + project JWT secret

export async function verifySupabaseToken(
	req: AuthenticatedRequest,
	res: any,
	next: any
) {
	try {
		const auth = String(req.headers.authorization || '');
		const token = auth.replace(/^Bearer\s+/i, '');
		if (!token) {
			if (process.env.MUTE_API_LOGS !== 'true') {
				console.error(`[AUTH_MW] 401 ${req.method} ${req.originalUrl} - Missing token`);
			}
			return res.status(401).json({ error: 'Missing token' });
		}
		if (!SUPABASE_URL) {
			if (process.env.MUTE_API_LOGS !== 'true') {
				console.error(`[AUTH_MW] 500 ${req.method} ${req.originalUrl} - SUPABASE_URL not set`);
			}
			return res.status(500).json({ error: 'Auth not configured' });
		}


		if (!SUPABASE_JWT_SECRET) {
			if (process.env.MUTE_API_LOGS !== 'true') {
				console.error(`[AUTH_MW] 500 ${req.method} ${req.originalUrl} - SUPABASE_JWT_SECRET not set`);
			}
			return res.status(500).json({ error: 'Auth not configured' });
		}

		// Verify HS256 tokens using the project's JWT secret
		let payload: any;
		try {
			payload = jwt.verify(token, SUPABASE_JWT_SECRET, {
				algorithms: ['HS256'],
				issuer: `${SUPABASE_URL}/auth/v1`,
				audience: 'authenticated',
				clockTolerance: 120,
			} as jwt.VerifyOptions) as any;
		} catch (e: any) {
			if (process.env.MUTE_API_LOGS !== 'true') {
				console.error(`[AUTH_MW] 401 ${req.method} ${req.originalUrl} - jwt verify failed: ${e?.message || e}`);
			}
			return res.status(401).json({ error: 'Invalid or expired token' });
		}

		// Attach minimal user context and raw claims
		req.user = {
			id: String(payload.sub || ''),
			email: typeof (payload as any).email === 'string' ? (payload as any).email.toLowerCase() : undefined,
		};
		req.claims = payload;

		if (process.env.MUTE_API_LOGS !== 'true') {
			console.log(`\x1b[33m[AUTH]\x1b[0m OK ${req.method} ${req.originalUrl} - sub=${req.user.id} aud=${(payload as any).aud}`);
		}
		return next();
	} catch (e: any) {
		if (process.env.MUTE_API_LOGS !== 'true') {
			console.error(`\x1b[33m[AUTH]\x1b[0m 401 ${req.method} ${req.originalUrl} - ${e?.message || e}`);
		}
		return res.status(401).json({ error: 'Invalid or expired token' });
	}
}
