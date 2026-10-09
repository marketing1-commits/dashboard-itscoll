import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getAnglesFromConfig } from "@/lib/sheets";
import { ANGLES, BRANDS } from "@/lib/config";

// GET: Fetch angles - tries Config tab first, falls back to hardcoded
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
    const configAngles = await getAnglesFromConfig();
    // Per brand: Config tab if it lists that brand (any capitalisation),
    // otherwise the built-in list — a brand's angles are never left empty.
    const byLower = new Map(
      Object.entries(configAngles).map(([k, v]) => [k.trim().toLowerCase(), v]),
    );
    const angles: Record<string, string[]> = {};
    for (const brand of BRANDS) {
      const fromConfig = byLower.get(brand.toLowerCase());
      angles[brand] = fromConfig && fromConfig.length ? fromConfig : ANGLES[brand];
    }
    return NextResponse.json({ angles });
  } catch {
    // If Config tab read fails, use hardcoded angles
    return NextResponse.json({ angles: ANGLES });
  }
}
