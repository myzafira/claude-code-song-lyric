import { NextResponse } from "next/server";
import { deleteBanner, updateBanner, type BannerInput } from "@/lib/notion.ts";
import { denyUnlessAdmin, fail } from "../../guard.ts";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    return NextResponse.json({ banner: await updateBanner(id, (await req.json()) as BannerInput) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = denyUnlessAdmin(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    await deleteBanner(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
