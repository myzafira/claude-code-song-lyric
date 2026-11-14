import { NextResponse } from "next/server";
import { DEFAULT_BANNERS, listBanners } from "@/lib/notion.ts";

export async function GET() {
  try {
    return NextResponse.json({ banners: await listBanners() });
  } catch {
    // never let the banner break the singing app
    return NextResponse.json({ banners: DEFAULT_BANNERS });
  }
}
