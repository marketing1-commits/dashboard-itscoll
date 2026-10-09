import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { updateRow, getRowById } from "@/lib/sheets";
import { BRANDS, Brand } from "@/lib/config";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const brand = body.brand as Brand;

  if (!brand || !BRANDS.includes(brand)) {
    return NextResponse.json({ error: "需要指定品牌" }, { status: 400 });
  }

  try {
    const existing = await getRowById(brand, id);
    if (!existing) {
      return NextResponse.json({ error: "内容不存在" }, { status: 404 });
    }

    // Only master or the creator can update
    if (user.role !== "master" && existing.creator !== user.name) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    // The name is never edited here: ads are matched to content by name,
    // and ranking is no longer part of it.
    const updates: Record<string, string> = {};

    // Copy other allowed fields
    for (const key of ["layer", "angles", "description", "fileName", "fileUrl"]) {
      if (body[key] !== undefined) {
        updates[key] = Array.isArray(body[key]) ? body[key].join(", ") : body[key];
      }
    }

    const updated = await updateRow(brand, id, updates);
    return NextResponse.json({ entry: updated ? { ...updated, brand } : null });
  } catch (err) {
    console.error("Failed to update content:", err);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand") as Brand;

  if (!brand || !BRANDS.includes(brand)) {
    return NextResponse.json({ error: "需要指定品牌" }, { status: 400 });
  }

  try {
    const entry = await getRowById(brand, id);
    if (!entry) {
      return NextResponse.json({ error: "内容不存在" }, { status: 404 });
    }
    return NextResponse.json({ entry: { ...entry, brand } });
  } catch (err) {
    console.error("Failed to get content:", err);
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}
