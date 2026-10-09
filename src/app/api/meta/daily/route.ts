import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getMetaDaily, getMetaAds } from "@/lib/sheets";
import { arrayToDailyRow } from "@/lib/meta";

// Daily Meta numbers per content; the page totals them for the chosen dates.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  try {
    const [dailyRaw, adsRaw] = await Promise.all([getMetaDaily(), getMetaAds()]);
    let rows = dailyRaw.map(arrayToDailyRow);
    let ads = adsRaw.map((a) => ({
      brand: String(a[0] ?? ""),
      contentId: String(a[1] ?? ""),
      firstAdDate: String(a[2] ?? ""),
    }));
    if (user.role !== "master") {
      rows = user.brand ? rows.filter((r) => r.brand === user.brand) : [];
      ads = user.brand ? ads.filter((a) => a.brand === user.brand) : [];
    }
    return NextResponse.json({ rows, ads });
  } catch (err) {
    console.error("Failed to read Meta daily:", err);
    return NextResponse.json(
      { error: `读取广告数据失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
