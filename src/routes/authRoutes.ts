import { Router } from 'express';
import { authenticateUser, getCurrentUser } from '../controllers/authController';
import { verifySupabaseToken } from '../middleware/supabaseAuth';

const r = Router();

// Routes that require Supabase token verification
r.post('/authenticate', verifySupabaseToken, authenticateUser);  // POST /auth/authenticate
r.get('/me', verifySupabaseToken, getCurrentUser);               // GET /auth/me

export default r;
