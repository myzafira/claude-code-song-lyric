import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin sign-in. The username and password live only in Vercel environment
 * variables (ADMIN_USER, ADMIN_PASSWORD); nothing secret is in the code.
 * A signed, http-only cookie keeps the admin signed in for 12 hours.
 */
export const ADMIN_COOKIE = "esl_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;

const adminUser = () => process.env.ADMIN_USER ?? "";
const adminPassword = () => process.env.ADMIN_PASSWORD ?? "";
// Changing ADMIN_SECRET (or the password) signs everyone out.
const secret = () => `${process.env.ADMIN_SECRET ?? ""}:${adminPassword()}`;

/** Admin is switched off until both a username and a long enough password are set. */
export const adminConfigured = () => adminUser().length > 0 && adminPassword().length >= 12;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkCredentials(user: string, password: string): boolean {
  if (!adminConfigured()) return false;
  // compare both even when the first fails, so timing does not reveal which was wrong
  const okUser = safeEqual(user, adminUser());
  const okPass = safeEqual(password, adminPassword());
  return okUser && okPass;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSession(now = Date.now()): string {
  const payload = `${adminUser()}.${now + SESSION_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | undefined, now = Date.now()): boolean {
  if (!token || !adminConfigured()) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  if (!safeEqual(token.slice(i + 1), sign(payload))) return false;
  const [user, exp] = [payload.slice(0, payload.lastIndexOf(".")), Number(payload.slice(payload.lastIndexOf(".") + 1))];
  return user === adminUser() && Number.isFinite(exp) && exp > now;
}

export const sessionCookie = (value: string, maxAgeSec: number) => ({
  name: ADMIN_COOKIE,
  value,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: maxAgeSec,
});

/** Reads the admin cookie from a request; true when it is a valid, unexpired session. */
export function isAdminRequest(req: Request): boolean {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  return verifySession(m ? decodeURIComponent(m[1]) : undefined);
}
