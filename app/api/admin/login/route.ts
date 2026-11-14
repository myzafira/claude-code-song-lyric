import { NextResponse } from "next/server";
import { adminConfigured, checkCredentials, createSession, sessionCookie } from "@/lib/admin-auth.ts";

// Slows down password guessing: a few failed tries per address within 10 minutes, then wait.
const failures = new Map<string, { n: number; until: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ADMIN_USER / ADMIN_PASSWORD ใน Vercel" }, { status: 503 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const now = Date.now();
  const f = failures.get(ip);
  if (f && f.until > now && f.n >= MAX_TRIES) {
    return NextResponse.json({ error: "ลองผิดหลายครั้งเกินไป รอ 10 นาทีแล้วลองใหม่" }, { status: 429 });
  }
  let body: { user?: unknown; password?: unknown } = {};
  try {
    body = await req.json();
  } catch {}
  const user = typeof body.user === "string" ? body.user.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!checkCredentials(user, password)) {
    const cur = f && f.until > now ? f : { n: 0, until: now + WINDOW_MS };
    cur.n++;
    failures.set(ip, cur);
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  failures.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(createSession(), 12 * 60 * 60));
  return res;
}
