import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getAllRows, upsertMetaDaily, replaceMetaAds } from "@/lib/sheets";
import {
  brandConfigs,
  fetchAccountDaily,
  fetchAccountAdList,
  matchContent,
  normalizeName,
  dailyRowToArray,
  isoDay,
  DailyRow,
} from "@/lib/meta";

// Paging through several ad accounts plus the Sheets writes can take a while.
export const maxDuration = 300;

const CRON_DAYS = 30; // nightly: re-pull a month so late attributions land
const MAX_BACKFILL_DAYS = 400;

type BrandReport = {
  brand: string;
  accounts: { account: string; ok: boolean; currency?: string; rows?: number; reason?: string }[];
  adsMatched: number;
  contentWithData: number;
  contentWithAds: number; // content with at least one ad created, spent or not
  // Ads with spend that matched no content — usually a naming mismatch
  unmatched: { adName: string; spend: string; currency: string }[];
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

async function runSync(mode: "cron" | "full") {
  const configs = brandConfigs();
  if (configs.length === 0) {
    return {
      ok: false,
      error: "还没有设定任何品牌的 META_TOKEN_<品牌> / META_ACCOUNTS_<品牌>",
    };
  }

  const allRows = await getAllRows();
  const until = isoDay(new Date());

  // Full sync starts from the first content ever created: an ad can't carry
  // a content name before that name existed.
  let since = isoDay(daysAgo(CRON_DAYS));
  if (mode === "full") {
    const created = allRows
      .map((r) => Date.parse(r.createdAt))
      .filter((t) => !isNaN(t));
    const earliest = created.length ? new Date(Math.min(...created)) : daysAgo(CRON_DAYS);
    const floor = daysAgo(MAX_BACKFILL_DAYS);
    since = isoDay(earliest < floor ? floor : earliest);
  }

  const reports: BrandReport[] = [];
  const daily = new Map<string, DailyRow>();
  const clearBrands: string[] = [];
  const adBrands: string[] = [];
  const adRows: (string | number)[][] = [];

  for (const cfg of configs) {
    const rows = allRows.filter((r) => r.brand === cfg.brand && r.name);
    const names = rows.map((r) => ({ key: r.contentId, norm: normalizeName(r.name) }));
    const unmatched = new Map<string, { spend: number; currency: string }>();
    const matchedAds = new Set<string>();
    const contentSeen = new Set<string>();

    const report: BrandReport = {
      brand: cfg.brand,
      accounts: [],
      adsMatched: 0,
      contentWithData: 0,
      contentWithAds: 0,
      unmatched: [],
    };

    let allAccountsOk = true;
    for (const account of cfg.accounts) {
      const res = await fetchAccountDaily(account, cfg.token, since, until);
      if (!res.ok) {
        allAccountsOk = false;
        report.accounts.push({ account, ok: false, reason: res.reason });
        continue;
      }
      report.accounts.push({ account, ok: true, currency: res.currency, rows: res.days.length });

      for (const d of res.days) {
        const contentId = matchContent(d.adName, names);
        if (!contentId) {
          if (d.spend > 0) {
            const u = unmatched.get(d.adName) || { spend: 0, currency: d.currency };
            u.spend += d.spend;
            unmatched.set(d.adName, u);
          }
          continue;
        }
        matchedAds.add(`${account}|${d.adName}`);
        contentSeen.add(contentId);

        const key = `${d.date}|${cfg.brand}|${contentId}|${d.currency}`;
        const row =
          daily.get(key) ||
          {
            date: d.date,
            brand: cfg.brand,
            contentId,
            currency: d.currency,
            spend: 0,
            impressions: 0,
            messaging: 0,
            purchases: 0,
            purchaseValue: 0,
          };
        row.spend += d.spend;
        row.impressions += d.impressions;
        row.messaging += d.messaging;
        row.purchases += d.purchases;
        row.purchaseValue += d.purchaseValue;
        daily.set(key, row);
      }
    }

    // Only wipe-and-rewrite a brand's window when every one of its accounts
    // was read; otherwise a failed account would erase its stored days.
    if (allAccountsOk) clearBrands.push(cfg.brand);

    // Ad list (includes ads that never spent) → first ad date per content
    const firstAd = new Map<string, { date: string; count: number }>();
    let adListOk = true;
    for (const account of cfg.accounts) {
      const list = await fetchAccountAdList(account, cfg.token);
      if (!list.ok) {
        adListOk = false;
        report.accounts.push({ account, ok: false, reason: `广告列表：${list.reason}` });
        continue;
      }
      for (const ad of list.ads) {
        const contentId = matchContent(ad.name, names);
        if (!contentId) continue;
        const f = firstAd.get(contentId);
        if (!f) firstAd.set(contentId, { date: ad.createdDate, count: 1 });
        else {
          f.count++;
          if (ad.createdDate < f.date) f.date = ad.createdDate;
        }
      }
    }
    if (adListOk) {
      adBrands.push(cfg.brand);
      for (const [contentId, f] of firstAd) adRows.push([cfg.brand, contentId, f.date, f.count]);
    }
    report.contentWithAds = firstAd.size;

    report.adsMatched = matchedAds.size;
    report.contentWithData = contentSeen.size;
    report.unmatched = [...unmatched.entries()]
      .sort((a, b) => b[1].spend - a[1].spend)
      .slice(0, 30)
      .map(([adName, u]) => ({ adName, spend: u.spend.toFixed(2), currency: u.currency }));
    reports.push(report);
  }

  // Rows for a brand whose accounts didn't all succeed are still written
  // (upsert), they just don't clear anything first.
  await replaceMetaAds(adBrands, adRows);

  const written = await upsertMetaDaily(
    [...daily.values()].map(dailyRowToArray),
    { brands: clearBrands, since, until },
  );

  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    since,
    until,
    dailyRows: written.updated + written.appended,
    brands: reports,
  };
}

// Manual full sync from the dashboard — master only
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }
  if (user.role !== "master") {
    return NextResponse.json({ error: "只有 master 可以同步" }, { status: 403 });
  }

  try {
    const result = await runSync("full");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("Meta sync failed:", err);
    return NextResponse.json(
      { ok: false, error: `同步失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

// Nightly sync from Vercel Cron. Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync("cron");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("Meta cron sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
