import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** Format: scrypt:<salt>:<hash> (base64url, no characters that need escaping in .env or compose). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT);
  return `scrypt:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, salt, hash] = stored.split(':');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

const sign = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('base64url');

/** Stateless session token: <expiry>.<hmac>. Rotate SESSION_SECRET to log out everywhere. */
export function makeSession(secret: string): string {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${sign(secret, exp)}`;
}

export function validSession(secret: string, token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(sign(secret, exp));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const requireAuth = (secret: string): MiddlewareHandler => async (c, next) => {
  if (!validSession(secret, getCookie(c, 'session'))) return c.json({ error: 'Not logged in' }, 401);
  await next();
};
