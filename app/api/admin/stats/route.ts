import { NextResponse } from "next/server";
import { getStats } from "@/lib/notion.ts";
import { denyUnlessAdmin, fail } from "../guard.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  try {
    return NextResponse.json(await getStats(days));
  } catch (e) {
    return fail(e, 502);
  }
}
