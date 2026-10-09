// Meta Marketing API — pull ad-level DAILY insights and match them to
// content rows by name, so the dashboard can total any date range.
//
// Configuration is per brand, all in Vercel env vars, so a brand is added
// later by adding vars only (no code change):
//
//   META_TOKEN_<BRAND>     system-user token (the same token may be reused
//                          for several brands in one business portfolio)
//   META_ACCOUNTS_<BRAND>  ad account IDs, comma-separated, e.g. act_1,act_2
//
// <BRAND> is the brand name upper-cased: OXYGRAINZ, FLEXIGLO, MULTIGRAINZ.
//
// Money stays in each ad account's own currency (no conversion). Every
// daily row carries its currency so the UI never labels SGD as RM.

import { BRANDS, Brand } from "./config";

const API_VERSION = process.env.META_API_VERSION || "v23.0";

export type BrandMetaConfig = {
  brand: Brand;
  token: string;
  accounts: string[];
};

export function brandConfigs(): BrandMetaConfig[] {
  const out: BrandMetaConfig[] = [];
  for (const brand of BRANDS) {
    const key = brand.toUpperCase();
    const token = process.env[`META_TOKEN_${key}`]?.trim();
    const accounts = (process.env[`META_ACCOUNTS_${key}`] || "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
      .map((a) => (a.startsWith("act_") ? a : `act_${a}`));
    if (token && accounts.length) out.push({ brand, token, accounts });
  }
  return out;
}

// One ad on one day.
export type AdDay = {
  date: string; // yyyy-MM-dd, in the ad account's time zone
  adName: string;
  currency: string;
  spend: number;
  impressions: number;
  purchases: number;
  purchaseValue: number;
  messaging: number;
};

type InsightAction = { action_type: string; value: string };
type InsightRow = {
  date_start?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  account_currency?: string;
  actions?: InsightAction[];
  action_values?: InsightAction[];
};

// First action type present wins — omni_* is Meta's de-duplicated total
// across web, app and on-Meta purchases.
const PURCHASE_TYPES = ["omni_purchase", "purchase", "onsite_web_purchase"];
const MESSAGING_TYPES = ["onsite_conversion.messaging_conversation_started_7d"];

function pick(list: InsightAction[] | undefined, types: string[]): number {
  if (!list) return 0;
  for (const t of types) {
    const hit = list.find((a) => a.action_type === t);
    if (hit) return parseFloat(hit.value) || 0;
  }
  return 0;
}

async function graphGet(url: string): Promise<{ data: InsightRow[]; paging?: { next?: string } }> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) {
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return body;
}

export type AccountResult =
  | { account: string; ok: true; currency: string; days: AdDay[] }
  | { account: string; ok: false; reason: string };

// Per-ad, per-day insights for one account between since and until (inclusive).
export async function fetchAccountDaily(
  account: string,
  token: string,
  since: string,
  until: string,
): Promise<AccountResult> {
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: "ad_name,spend,impressions,actions,action_values,account_currency",
    limit: "500",
    access_token: token,
  });
  let url: string | undefined =
    `https://graph.facebook.com/${API_VERSION}/${account}/insights?${params}`;

  const rows: InsightRow[] = [];
  try {
    while (url) {
      const page = await graphGet(url);
      rows.push(...page.data);
      url = page.paging?.next;
    }
  } catch (err) {
    return { account, ok: false, reason: err instanceof Error ? err.message : String(err) };
  }

  const currency = rows[0]?.account_currency || "";
  const days: AdDay[] = rows
    .filter((r) => r.ad_name && r.date_start)
    .map((r) => ({
      date: r.date_start!,
      adName: r.ad_name!,
      currency: r.account_currency || currency,
      spend: parseFloat(r.spend || "0") || 0,
      impressions: parseInt(r.impressions || "0", 10) || 0,
      purchases: pick(r.actions, PURCHASE_TYPES),
      purchaseValue: pick(r.action_values, PURCHASE_TYPES),
      messaging: pick(r.actions, MESSAGING_TYPES),
    }));

  return { account, ok: true, currency, days };
}

// Every ad in an account — including ones that never delivered, which
// insights leave out entirely. Used to spot "launched but no spend".
export type AdInfo = { name: string; createdDate: string; status: string };

export type AdListResult =
  | { account: string; ok: true; ads: AdInfo[] }
  | { account: string; ok: false; reason: string };

export async function fetchAccountAdList(account: string, token: string): Promise<AdListResult> {
  const params = new URLSearchParams({
    fields: "name,created_time,effective_status",
    limit: "500",
    access_token: token,
  });
  let url: string | undefined =
    `https://graph.facebook.com/${API_VERSION}/${account}/ads?${params}`;

  const ads: AdInfo[] = [];
  try {
    while (url) {
      const res: Response = await fetch(url, { cache: "no-store" });
      const body: {
        data?: unknown[];
        paging?: { next?: string };
        error?: { message?: string };
      } | null = await res.json().catch(() => null);
      if (!res.ok || !body || body.error) {
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      for (const a of (body.data || []) as { name?: string; created_time?: string; effective_status?: string }[]) {
        if (!a.name || !a.created_time) continue;
        ads.push({
          name: a.name,
          createdDate: isoDay(new Date(a.created_time)),
          status: a.effective_status || "",
        });
      }
      url = body.paging?.next;
    }
  } catch (err) {
    return { account, ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  return { account, ok: true, ads };
}

// Names are compared case-insensitively with whitespace collapsed, so
// "Kayson  -VI 12- …" and "kayson -VI 12- …" match.
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// An ad belongs to a content item when the ad name contains the content
// name (marketers paste the copied name, sometimes with a suffix like
// " - copy"). If several content names fit, the longest — most specific — wins.
export function matchContent(adName: string, contentNames: { key: string; norm: string }[]): string | null {
  const ad = normalizeName(adName);
  let best: { key: string; len: number } | null = null;
  for (const c of contentNames) {
    if (c.norm && ad.includes(c.norm) && (!best || c.norm.length > best.len)) {
      best = { key: c.key, len: c.norm.length };
    }
  }
  return best?.key ?? null;
}

// One stored row: a content item's totals for one day in one currency.
export type DailyRow = {
  date: string;
  brand: string;
  contentId: string;
  currency: string;
  spend: number;
  impressions: number;
  messaging: number;
  purchases: number;
  purchaseValue: number;
};

// Column order shared with the MetaDaily tab in Apps Script.
export function dailyRowToArray(r: DailyRow): (string | number)[] {
  return [
    r.date,
    r.brand,
    r.contentId,
    r.currency,
    round2(r.spend),
    r.impressions,
    Math.round(r.messaging),
    Math.round(r.purchases),
    round2(r.purchaseValue),
  ];
}

export function arrayToDailyRow(a: unknown[]): DailyRow {
  const n = (v: unknown) => parseFloat(String(v ?? "")) || 0;
  return {
    date: String(a[0] ?? ""),
    brand: String(a[1] ?? ""),
    contentId: String(a[2] ?? ""),
    currency: String(a[3] ?? ""),
    spend: n(a[4]),
    impressions: n(a[5]),
    messaging: n(a[6]),
    purchases: n(a[7]),
    purchaseValue: n(a[8]),
  };
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}

// yyyy-MM-dd in Malaysia time (the ad accounts' time zone), not UTC —
// at 3am MYT the UTC date is still yesterday.
export function isoDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
