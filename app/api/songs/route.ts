import { NextResponse } from "next/server";
import { getAllSongs } from "@/lib/notion.ts";
import { popularSongs, searchSongs } from "@/lib/search.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  try {
    const all = await getAllSongs();
    const songs = q ? searchSongs(q, all) : popularSongs(all);
    return NextResponse.json({ songs, total: all.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ songs: [], error: "load_failed" }, { status: 502 });
  }
}
