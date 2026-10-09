import type { Ranking } from "./config";

// Auto ABCD ranking from CPM, ROAS and Purchases, judged differently per
// layer. Change a number here and every rank follows.
export const RANK_RULES = {
  cpmGood: 15,      // CPM below this (RM) passes
  cpmBad: 25,       // Layer 1: CPM at or above this is D
  roasGood: 3,      // ROAS at or above this passes
  purchasesGood: 3, // Purchases at or above this passes
  minSpend: 100,    // spend below this (RM) → NIL (not enough data)
  noSpendDays: 7,   // ad live this many days with zero spend → D
};

type Metrics = {
  layer: string;
  spend: number;
  cpm: number | null; // null when there were no impressions
  roas: number;
  purchases: number;
};

// "NIL" when there isn't enough spend to judge; null when the content has
// no layer, so no rule applies (the caller keeps the manual rank).
export function autoRank(m: Metrics): Ranking | null {
  const R = RANK_RULES;
  if (!(m.spend >= R.minSpend) || m.cpm === null) return "NIL";

  const cpmOk = m.cpm < R.cpmGood;
  const roasOk = m.roas >= R.roasGood;
  const purchasesOk = m.purchases >= R.purchasesGood;

  switch (m.layer) {
    // Layer 1 — reach: CPM leads
    case "Layer 1":
      if (cpmOk) return roasOk || purchasesOk ? "A" : "B";
      if (m.cpm < R.cpmBad) return "C";
      return "D";

    // Layer 3 — conversion: Purchases and ROAS lead
    case "Layer 3":
      if (roasOk && purchasesOk) return "A";
      if (roasOk || purchasesOk) return "B";
      if (cpmOk) return "C";
      return "D";

    // Layer 2 — all three count equally
    case "Layer 2": {
      const passes = [cpmOk, roasOk, purchasesOk].filter(Boolean).length;
      return (["D", "C", "B", "A"] as const)[passes];
    }

    // No layer set — can't tell which rule applies
    default:
      return null;
  }
}

export const RANK_EXPLAIN: Record<string, Record<Ranking, string>> = {
  "Layer 1": {
    A: "CPM < 15，而且 ROAS ≥ 3 或 Purchases ≥ 3",
    B: "CPM < 15",
    C: "CPM 15–25",
    D: "CPM ≥ 25",
    NIL: "花费不到 RM100，还不能判断",
  },
  "Layer 2": {
    A: "CPM、ROAS、Purchases 三关全过",
    B: "过 2 关",
    C: "过 1 关",
    D: "0 关",
    NIL: "花费不到 RM100，还不能判断",
  },
  "Layer 3": {
    A: "ROAS ≥ 3 而且 Purchases ≥ 3",
    B: "ROAS ≥ 3 或 Purchases ≥ 3",
    C: "两个都没过，CPM < 15",
    D: "全部没过",
    NIL: "花费不到 RM100，还不能判断",
  },
};

// Shown instead of the layer rule when D comes from "live but no spend".
export const NO_SPEND_EXPLAIN = `广告上了 ${RANK_RULES.noSpendDays} 天以上，一直没有花费`;

// Whole days between a yyyy-MM-dd date and today (local time).
export function daysSince(isoDate: string): number {
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}
