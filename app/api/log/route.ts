import { NextResponse } from "next/server";
import { writeLog } from "@/lib/notion.ts";
import type { LogEvent, LogType } from "@/lib/types.ts";

const TYPES: LogType[] = ["search", "search_miss", "queue_add", "play", "like", "dislike", "request"];
const clip = (v: unknown, n = 300) => (typeof v === "string" ? v.slice(0, n) : undefined);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!TYPES.includes(body.type as LogType)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ev: LogEvent = {
    type: body.type as LogType,
    query: clip(body.query),
    songId: clip(body.songId, 64),
    songTitle: clip(body.songTitle),
    results: typeof body.results === "number" ? body.results : undefined,
    session: clip(body.session, 64),
    device: clip(req.headers.get("user-agent") ?? "", 200),
  };
  await writeLog(ev);
  return NextResponse.json({ ok: true });
}
