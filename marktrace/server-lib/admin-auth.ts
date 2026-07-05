import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

const SESSION_COOKIE = 'pf_admin_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';

interface SessionPayload {
  email: string;
  exp: number;
}

function getAdminEmail(): string | undefined {
  return process.env.ADMIN_EMAIL?.trim();
}

function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

function getSessionSecret(): string | undefined {
  return process.env.SESSION_SECRET?.trim() || getAdminPassword();
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function encodeSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(body, secret);
  return `${body}.${sig}`;
}

function decodeSession(token: string, secret: string): SessionPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = signPayload(body, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload.email || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function cookieFlags(maxAgeSeconds: number): string {
  const secure = isProduction ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminEmail() && getAdminPassword());
}

export function validateAdminCredentials(email: string, password: string): boolean {
  const adminEmail = getAdminEmail();
  const adminPassword = getAdminPassword();
  if (!adminEmail || !adminPassword) return false;

  const emailBuf = Buffer.from(email.trim());
  const expectedEmailBuf = Buffer.from(adminEmail);
  const passBuf = Buffer.from(password);
  const expectedPassBuf = Buffer.from(adminPassword);

  if (emailBuf.length !== expectedEmailBuf.length || passBuf.length !== expectedPassBuf.length) {
    return false;
  }

  return (
    timingSafeEqual(emailBuf, expectedEmailBuf) && timingSafeEqual(passBuf, expectedPassBuf)
  );
}

export function setAdminSession(res: Response, email: string): void {
  const secret = getSessionSecret();
  if (!secret) return;

  const token = encodeSession(
    { email, exp: Date.now() + SESSION_MAX_AGE_MS },
    secret,
  );

  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieFlags(Math.floor(SESSION_MAX_AGE_MS / 1000))}`,
  );
}

export function clearAdminSession(res: Response): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieFlags(0)}`);
}

export function getAdminSession(req: Request): SessionPayload | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  return decodeSession(token, secret);
}

export function requireAdmin(req: Request, res: Response): SessionPayload | null {
  if (!isAdminConfigured()) {
    res.status(503).json({ message: 'Admin is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.' });
    return null;
  }

  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  return session;
}
