import type { ContentRecord } from "./types";
import type { DailyRow } from "./meta";
import { autoRank, daysSince, RANK_RULES, NO_SPEND_EXPLAIN } from "./ranking";

export type FirstAd = { brand: string; contentId: string; firstAdDate: string };

// Replace each content's Meta numbers with totals for [from, to] (yyyy-MM-dd,
// either may be empty = open-ended), computed from the synced daily rows.
//
// Content that has never been synced keeps whatever is typed in the sheet.
// Content that has synced data but nothing in the range shows blanks.
// Ranking is computed from the same range totals (see ranking.ts).
export function applyMetaRange(
  data: ContentRecord[],
  daily: DailyRow[],
  from: string,
  to: string,
  firstAds: FirstAd[] = [],
): ContentRecord[] {
  const synced = new Set<string>();
  const lifetimeSpend = new Map<string, number>();
  const firstAdDate = new Map(firstAds.map((a) => [`${a.brand}|${a.contentId}`, a.firstAdDate]));
  const totals = new Map<
    string,
    { spend: number; impressions: number; messaging: number; purchases: number; value: number; currencies: Set<string> }
  >();

  for (const r of daily) {
    const key = `${r.brand}|${r.contentId}`;
    synced.add(key);
    lifetimeSpend.set(key, (lifetimeSpend.get(key) || 0) + r.spend);
    if (from && r.date < from) continue;
    if (to && r.date > to) continue;

    const t =
      totals.get(key) ||
      { spend: 0, impressions: 0, messaging: 0, purchases: 0, value: 0, currencies: new Set<string>() };
    t.spend += r.spend;
    t.impressions += r.impressions;
    t.messaging += r.messaging;
    t.purchases += r.purchases;
    t.value += r.purchaseValue;
    if (r.currency) t.currencies.add(r.currency);
    totals.set(key, t);
  }

  return data.map((c) => {
    const key = `${c.brand}|${c.contentId}`;

    // Ads created N+ days ago that have never spent anything → D,
    // whatever the date range: Meta isn't delivering this content.
    const launched = firstAdDate.get(key);
    if (
      launched &&
      daysSince(launched) >= RANK_RULES.noSpendDays &&
      !((lifetimeSpend.get(key) || 0) > 0)
    ) {
      return {
        ...c,
        amountSpent: "",
        impressions: "",
        cpm: "",
        messagingStarted: "",
        purchases: "",
        purchaseRoas: "",
        ranking: "D",
        rankNote: `${NO_SPEND_EXPLAIN}（第一个广告 ${launched}）`,
        currency: "MYR",
      };
    }

    if (!synced.has(key)) return { ...c, currency: "MYR" };

    const t = totals.get(key);
    if (!t || (t.spend === 0 && t.impressions === 0)) {
      return {
        ...c,
        amountSpent: "",
        impressions: "",
        cpm: "",
        messagingStarted: "",
        purchases: "",
        purchaseRoas: "",
        ranking: "NIL",
        currency: "MYR",
      };
    }

    // One content running in both MY and SG accounts would add RM to S$;
    // flag it rather than show a number with the wrong symbol.
    const currency = t.currencies.size > 1 ? "MIXED" : [...t.currencies][0] || "MYR";

    const cpm = t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null;
    const roas = t.spend > 0 ? t.value / t.spend : 0;
    const rank = autoRank({
      layer: c.layer,
      spend: t.spend,
      cpm,
      roas,
      purchases: Math.round(t.purchases),
    });

    return {
      ...c,
      // No layer set → no rule applies; keep the sheet's manual rank
      ranking: rank ?? (c.ranking || "NIL"),
      amountSpent: t.spend.toFixed(2),
      impressions: String(t.impressions),
      cpm: t.impressions > 0 ? ((t.spend / t.impressions) * 1000).toFixed(2) : "",
      messagingStarted: String(Math.round(t.messaging)),
      purchases: String(Math.round(t.purchases)),
      purchaseRoas: t.spend > 0 ? (t.value / t.spend).toFixed(2) : "",
      currency,
    };
  });
}

export function currencySymbol(currency?: string): string {
  if (!currency || currency === "MYR") return "RM";
  if (currency === "SGD") return "S$";
  if (currency === "MIXED") return "⚠混合币种 ";
  return currency + " ";
}
