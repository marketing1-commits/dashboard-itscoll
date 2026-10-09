import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { BRANDS, Brand } from "@/lib/config";
import { createResumableUpload } from "@/lib/drive";

// POST: Get a resumable upload URL for browser-direct upload
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  const body = await req.json();
  const { brand, fileName, mimeType } = body;

  if (!brand || !BRANDS.includes(brand)) {
    return NextResponse.json({ error: "无效品牌" }, { status: 400 });
  }

  if (!fileName || !mimeType) {
    return NextResponse.json({ error: "缺少文件信息" }, { status: 400 });
  }

  try {
    // Drive only allows the browser's PUT if the upload session was
    // opened for that same origin, so pass it through.
    const origin = req.headers.get("origin") || new URL(req.url).origin;

    const { uploadUrl } = await createResumableUpload(
      brand as Brand,
      fileName,
      mimeType,
      origin,
    );

    return NextResponse.json({ uploadUrl });
  } catch (err) {
    console.error("Failed to create upload session:", err);
    return NextResponse.json({ error: `创建上传失败：${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
