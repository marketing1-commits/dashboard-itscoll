"use client";
import { useState, useEffect } from "react";
import { BRANDS, LAYERS, RANKINGS, User, Ranking } from "@/lib/config";
import { ContentRecord } from "@/lib/types";
import { currencySymbol } from "@/lib/metaRange";
import { RANK_EXPLAIN } from "@/lib/ranking";

type Props = {
  data: ContentRecord[];
  user: User;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => void;
  // Lets the parent page keep its analytics in sync with the table's filters
  onFilteredChange?: (rows: ContentRecord[]) => void;
};

const RANK_KEYS = Object.keys(RANKINGS) as Ranking[];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy name"
      className="ml-1.5 px-1.5 py-0.5 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--accent)]/15 text-[var(--accent)] shrink-0"
    >
      {copied ? "✓" : "📋"}
    </button>
  );
}

export default function ContentTable({
  data,
  user,
  authFetch,
  onRefresh,
  onFilteredChange,
}: Props) {
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCreator, setFilterCreator] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [filterLayer, setFilterLayer] = useState("");
  const [filterLive, setFilterLive] = useState("");

  const filtered = data.filter((c) => {
    if (filterBrand && c.brand !== filterBrand) return false;
    if (filterCreator && c.creator !== filterCreator) return false;
    if (filterRank && (c.ranking || "NIL") !== filterRank) return false;
    if (filterLayer && c.layer !== filterLayer) return false;
    if (filterLive === "Yes" && c.isLive !== "Yes") return false;
    if (filterLive === "No" && c.isLive === "Yes") return false;
    return true;
  });

  // Keep the parent informed so page-level analytics follow these filters
  useEffect(() => {
    onFilteredChange?.(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterBrand, filterCreator, filterRank, filterLayer, filterLive]);

  const creators = [...new Set(data.map((c) => c.creator))].filter(Boolean).sort();
  const hasActiveFilters = filterBrand || filterCreator || filterRank || filterLayer || filterLive;

  const selectClass =
    "bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none";

  // Format money in the content's own ad-account currency (RM / S$)
  const fmtMoney = (val: string | undefined, currency?: string) => {
    if (!val) return "—";
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return `${currencySymbol(currency)}${n.toFixed(2)}`;
  };

  // Format ROAS
  const fmtRoas = (val: string) => {
    if (!val) return "—";
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return n.toFixed(2);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className={selectClass}>
          <option value="">All Brands</option>
          {BRANDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select value={filterCreator} onChange={(e) => setFilterCreator(e.target.value)} className={selectClass}>
          <option value="">All Creators</option>
          {creators.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select value={filterRank} onChange={(e) => setFilterRank(e.target.value)} className={selectClass}>
          <option value="">All Ranks</option>
          {RANK_KEYS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select value={filterLayer} onChange={(e) => setFilterLayer(e.target.value)} className={selectClass}>
          <option value="">All Layers</option>
          {LAYERS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <select value={filterLive} onChange={(e) => setFilterLive(e.target.value)} className={selectClass}>
          <option value="">All Status</option>
          <option value="Yes">🟢 Live</option>
          <option value="No">Not Live</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterBrand("");
              setFilterCreator("");
              setFilterRank("");
              setFilterLayer("");
              setFilterLive("");
            }}
            className="px-3 py-2 text-xs text-[var(--accent)] hover:underline"
          >
            Clear all
          </button>
        )}

        <div className="ml-auto text-sm text-[var(--text-secondary)] self-center">
          {filtered.length} records
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-input)] text-[var(--text-secondary)]">
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">#</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Creator</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">广告日期</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap min-w-[280px]">Name</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Brand</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Layer</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Rank</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Live</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">Spent</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">CPM</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">MSG</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">Purchases</th>
              <th className="text-right px-4 py-3 font-medium whitespace-nowrap">ROAS</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Angle</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">File</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={15} className="text-center py-12 text-[var(--text-secondary)]">
                  还没有内容记录，点击 "＋ New content" 开始创建
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const angleList = c.angles
                  ? c.angles.split(",").map((a) => a.trim()).filter(Boolean)
                  : [];

                const rank = (c.ranking || "NIL") as Ranking;
                const rankInfo = RANKINGS[rank] || RANKINGS.NIL;

                const spent = parseFloat(c.amountSpent || "0");
                const isLowSpend = c.isLive === "Yes" && spent > 0 && spent < 2;

                return (
                  <tr
                    key={c.contentId}
                    className="border-t border-[var(--border)] hover:bg-[var(--bg-hover)] transition group"
                  >
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{c.seqNo}</td>
                    <td className="px-4 py-3">
                      <span className="bg-[var(--brand-brown)]/20 text-[var(--brand-brown)] px-2.5 py-1 rounded-md text-xs font-medium">
                        {c.creator}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{c.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <span className="text-[var(--text-primary)] font-medium">{c.name}</span>
                        <CopyButton text={c.name} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--text-secondary)]">{c.brand}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.layer && (
                        <span className="bg-[var(--brand-gold)]/20 text-[var(--brand-gold)] px-2 py-1 rounded-md text-xs">
                          {c.layer}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        title={c.rankNote || RANK_EXPLAIN[c.layer]?.[rank] || ""}
                        className="px-2 py-1 rounded-md text-xs font-semibold"
                        style={{
                          backgroundColor: rankInfo.color + "22",
                          color: rankInfo.color,
                        }}
                      >
                        {rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.isLive === "Yes" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-md font-medium">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          Live
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)] opacity-50">—</span>
                      )}
                    </td>
                    {/* Meta Ads metrics */}
                    <td className={`px-4 py-3 text-right text-xs whitespace-nowrap ${isLowSpend ? "text-red-500 font-medium" : "text-[var(--text-secondary)]"}`}>
                      {fmtMoney(c.amountSpent, c.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {fmtMoney(c.cpm, c.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--text-secondary)]">
                      {c.messagingStarted || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--text-secondary)]">
                      {c.purchases || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--text-secondary)]">
                      {fmtRoas(c.purchaseRoas)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {angleList.map((a) => (
                          <span
                            key={a}
                            className="bg-[var(--accent)]/15 text-[var(--accent)] px-2 py-0.5 rounded-md text-xs"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.fileName ? (
                        <a
                          href={c.fileUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          {c.fileName.length > 15 ? c.fileName.slice(0, 15) + "..." : c.fileName}
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)] opacity-40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
