import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getNextSeqNo } from "@/lib/sheets";
import { BRANDS, Brand } from "@/lib/config";

// The number the next content of this brand will get (highest existing + 1,
// or 1 when the brand has none). Shown in the form preview; the number is
// only claimed for real on submit.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  const brand = new URL(req.url).searchParams.get("brand") as Brand;
  if (!brand || !BRANDS.includes(brand)) {
    return NextResponse.json({ error: "无效品牌" }, { status: 400 });
  }

  try {
    const seqNo = await getNextSeqNo(brand);
    return NextResponse.json({ seqNo });
  } catch (err) {
    return NextResponse.json(
      { error: `读取编号失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
