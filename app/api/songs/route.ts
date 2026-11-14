import { NextResponse } from "next/server";
import { getAllSongs } from "@/lib/notion.ts";
import { popularSongs, searchSongs, type SearchBy } from "@/lib/search.ts";
import type { LinkType } from "@/lib/types.ts";

const BY: SearchBy[] = ["all", "title", "artist", "album"];
const TYPES = ["all", "karaoke", "vocal"] as const;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const byParam = params.get("by") as SearchBy;
  const by = BY.includes(byParam) ? byParam : "all";
  const typeParam = params.get("type") as LinkType | "all";
  const type = TYPES.includes(typeParam) ? typeParam : "all";
  try {
    const all = await getAllSongs();
    const songs = q ? searchSongs(q, all, { by, type }) : popularSongs(all, 12, type);
    return NextResponse.json({ songs, total: all.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ songs: [], error: "load_failed" }, { status: 502 });
  }
}
