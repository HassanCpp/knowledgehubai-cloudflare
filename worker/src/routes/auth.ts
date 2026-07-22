import { Hono } from 'hono';
import { registerUser, loginUser, getMe } from '../services/auth.service';
import { authMiddleware } from '../middleware/auth.middleware';
import type { Env, HonoVars } from '../types';

const auth = new Hono<{ Bindings: Env; Variables: HonoVars }>();

// POST /api/auth/register
auth.post('/register', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400);
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

  // Role is determined automatically in registerUser based on the admin email constant
  const result = await registerUser(c.env, email, password);
  return c.json(result, 201);
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400);

  const result = await loginUser(c.env, email, password);
  return c.json(result);
});

// GET /api/auth/me
auth.get('/me', authMiddleware, async (c) => {
  const user = await getMe(c.env, c.get('userId'));
  return c.json(user);
});

// POST /api/auth/logout (stateless — client drops token)
auth.post('/logout', authMiddleware, (c) => c.json({ message: 'Logged out successfully' }));

export default auth;
