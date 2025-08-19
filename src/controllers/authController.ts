import { Response } from 'express';
import { controller } from '../middleware/logging';
import { AuthenticatedRequest } from '../middleware/supabaseAuth';
import User from '../db/models/User';

// Authenticate user with Supabase token and sync with backend
export const authenticateUser = controller(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'User not authenticated',
      code: 'UNAUTHORIZED'
    });
  }

  const { email } = req.user;
  const claims = (req as any).claims || {};

  try {
    if (!email) {
      return res.status(422).json({
        error: 'Email missing in token; cannot sync user with current schema',
        code: 'EMAIL_REQUIRED'
      });
    }
    // Check if user exists in our database
    let user;
    try {
      user = await User.findByEmail(email);
      console.log(`[AUTH] Existing user logged in: ${email}`);
    } catch (error) {
      // User doesn't exist, create them
      console.log(`[AUTH] Creating new user: ${email}`);
      const displayName = (claims.user_metadata && (claims.user_metadata.full_name || claims.user_metadata.name)) || (email ? email.split('@')[0] : 'User');
      user = await User.create(email, [], displayName);
      // Best-effort cache of supabase fields
      try {
        await (await import('../db/models')).db('users').where({ email }).update({
          supabase_user_id: claims.sub || null,
          avatar_url: claims.user_metadata?.avatar_url || claims.user_metadata?.picture || null,
          last_provider: claims.app_metadata?.provider || null,
          last_login: new Date().toISOString()
        });
      } catch {}
    }

    // Return user data (without sensitive info)
    res.json({
      id: user.email, // Use email as ID since that's the primary key
      email: user.email,
      name: user.name,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('[AUTH] Error syncing user:', error);
    res.status(500).json({
      error: 'Failed to sync user with backend',
      code: 'SYNC_ERROR'
    });
  }
});

// Get current user info
export const getCurrentUser = controller(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'User not authenticated',
      code: 'UNAUTHORIZED'
    });
  }
  try {
    if (!req.user.email) {
      return res.status(422).json({ error: 'Email missing in token', code: 'EMAIL_REQUIRED' });
    }
    const user = await User.findByEmail(req.user.email);
    res.json({
      id: user.email, // Use email as ID since that's the primary key
      email: user.email,
      name: user.name,
      created_at: user.created_at
    });
  } catch (error) {
    res.status(404).json({
      error: 'User not found in backend',
      code: 'USER_NOT_FOUND'
    });
  }
});
