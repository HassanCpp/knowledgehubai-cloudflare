// ─── Auth Service ─────────────────────────────────────────────────────────────

import { SignJWT } from 'jose';
import { hashPassword, verifyPassword } from '../utils/hash';
import { findUserByEmail, createUser, findUserById } from '../db/queries';
import type { Env } from '../types';

// ─── Hardcoded admin email — only this address can ever hold the 'admin' role ──
const ADMIN_EMAIL = 'hassanwaqar475@gmail.com';

export async function registerUser(
  env: Env,
  email: string,
  password: string,
): Promise<{ token: string; user: { id: string; email: string; role: string } }> {
  const existing = await findUserByEmail(env.DB, email);
  if (existing) throw new Error('Email already registered');

  const passwordHash = await hashPassword(password);
  // Only the designated admin email gets the admin role — everyone else is 'user'
  const role = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
  const user = await createUser(env.DB, email, passwordHash, role);
  const token = await signJWT(env, user.id, user.role);

  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

export async function loginUser(
  env: Env,
  email: string,
  password: string
): Promise<{ token: string; user: { id: string; email: string; role: string } }> {
  const user = await findUserByEmail(env.DB, email);
  if (!user) throw new Error('Invalid credentials');

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');

  const token = await signJWT(env, user.id, user.role);
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

export async function getMe(env: Env, userId: string) {
  const user = await findUserById(env.DB, userId);
  if (!user) throw new Error('User not found');
  return { id: user.id, email: user.email, role: user.role };
}



// ─── JWT Helper ───────────────────────────────────────────────────────────────

async function signJWT(env: Env, userId: string, role: string): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(env.JWT_EXPIRES_IN ?? '7d')
    .setIssuedAt()
    .sign(secret);
}
