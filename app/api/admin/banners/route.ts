import { NextResponse } from "next/server";
import { bannersEnabled, createBanner, listBanners, type BannerInput } from "@/lib/notion.ts";
import { denyUnlessAdmin, fail } from "../guard.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ enabled: bannersEnabled(), banners: await listBanners(true) });
  } catch (e) {
    return fail(e, 502);
  }
}

export async function POST(req: Request) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ banner: await createBanner((await req.json()) as BannerInput) });
  } catch (e) {
    return fail(e);
  }
}
