import { NextResponse } from "next/server";
import { adminConfigured, isAdminRequest } from "@/lib/admin-auth.ts";

/** Returns an error response when the request is not from a signed-in admin, otherwise null. */
export function denyUnlessAdmin(req: Request): NextResponse | null {
  if (!adminConfigured()) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า admin ใน Vercel" }, { status: 503 });
  if (!isAdminRequest(req)) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  return null;
}

export const fail = (e: unknown, status = 400) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
