import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

const SESSION_COOKIE = 'gokul_admin_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const secret = import.meta.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set.');
  }
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

export function createSessionToken(): string {
  const expiry = Date.now() + SESSION_DURATION_MS;
  const payload = String(expiry);
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return false;

  const expiry = Number(payload);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  return true;
}

export function checkPassword(candidate: string): boolean {
  const adminPassword = import.meta.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const candidateBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(adminPassword);
  if (candidateBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(candidateBuf, expectedBuf);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export function isAuthenticated(cookies: AstroCookies): boolean {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
