import type { Context, Next } from 'hono';
import type { Env, HonoVars } from '../types';

// ─── Role-Based Access Control Middleware ─────────────────────────────────────

export function requireRole(role: 'admin' | 'user') {
  return async (
    c: Context<{ Bindings: Env; Variables: HonoVars }>,
    next: Next
  ): Promise<Response | void> => {
    const userRole = c.get('userRole');
    if (userRole !== role && !(role === 'user' && userRole === 'admin')) {
      return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
    }
    await next();
  };
}

export const adminOnly = requireRole('admin');
