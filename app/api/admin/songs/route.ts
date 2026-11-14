import { NextResponse } from "next/server";
import { createSong, listSongsAdmin, type SongInput } from "@/lib/notion.ts";
import { denyUnlessAdmin, fail } from "../guard.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ songs: await listSongsAdmin() });
  } catch (e) {
    return fail(e, 502);
  }
}

export async function POST(req: Request) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;
  try {
    const input = (await req.json()) as SongInput;
    return NextResponse.json({ song: await createSong(input) });
  } catch (e) {
    return fail(e);
  }
}
