import { NextResponse } from "next/server";
import { updateSong, type SongInput } from "@/lib/notion.ts";
import { denyUnlessAdmin, fail } from "../../guard.ts";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    const input = (await req.json()) as SongInput;
    return NextResponse.json({ song: await updateSong(id, input) });
  } catch (e) {
    return fail(e);
  }
}
