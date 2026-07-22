import { jwtVerify } from 'jose';
import type { Context, Next } from 'hono';
import type { Env, HonoVars } from '../types';

// ─── JWT Auth Middleware ──────────────────────────────────────────────────────

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: HonoVars }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing token' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (!payload.userId || !payload.role) {
      return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);
    }

    c.set('userId', payload.userId as string);
    c.set('userRole', payload.role as string);
    await next();
  } catch {
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }
}
