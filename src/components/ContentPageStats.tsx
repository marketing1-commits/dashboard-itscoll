"use client";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { RANKINGS, Ranking } from "@/lib/config";
import { ContentRecord } from "@/lib/types";
import { currencySymbol } from "@/lib/metaRange";

type Props = {
  data: ContentRecord[];
};

const RANK_KEYS: Ranking[] = ["A", "B", "C", "D", "NIL"];

// Custom label for pie chart
const renderPieLabel = (props: {
  name?: string;
  value?: number;
  percent?: number;
}) => {
  const { name, value, percent } = props;
  if (!percent || percent < 0.04) return null;
  return `${name || ""} (${value || 0})`;
};

export default function ContentPageStats({ data }: Props) {
  // --- Rank distribution ---
  const rankData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of RANK_KEYS) counts[r] = 0;
    for (const c of data) {
      const rank = (c.ranking || "NIL") as string;
      if (rank in counts) counts[rank]++;
      else counts["NIL"]++;
    }
    return RANK_KEYS.map((r) => ({
      rank: r,
      count: counts[r],
      color: RANKINGS[r].color,
    }));
  }, [data]);

  // --- Angle distribution ---
  const angleData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of data) {
      if (!c.angles) continue;
      const angles = c.angles.split(",").map((a) => a.trim()).filter(Boolean);
      for (const a of angles) {
        counts[a] = (counts[a] || 0) + 1;
      }
    }
    // Sort descending by count
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [data]);

  // --- Unique live ads ---
  const uniqueLive = useMemo(() => {
    const liveNames = new Set<string>();
    for (const c of data) {
      if (c.isLive === "Yes") {
        liveNames.add(c.name);
      }
    }
    return liveNames.size;
  }, [data]);

  // --- Meta Ads stats ---
  const metaStats = useMemo(() => {
    // RM and S$ are never added together
    const spentByCurrency: Record<string, number> = {};
    let totalPurchases = 0;
    let totalMsg = 0;
    let lowSpend = 0; // live but spent < RM2
    let noPurchase = 0; // live but 0 purchases

    for (const c of data) {
      const spent = parseFloat(c.amountSpent || "0");
      const purchases = parseInt(c.purchases || "0", 10);
      const msg = parseInt(c.messagingStarted || "0", 10);

      if (!isNaN(spent) && spent > 0) {
        const cur = c.currency || "MYR";
        spentByCurrency[cur] = (spentByCurrency[cur] || 0) + spent;
      }
      if (!isNaN(purchases)) totalPurchases += purchases;
      if (!isNaN(msg)) totalMsg += msg;

      if (c.isLive === "Yes") {
        if (spent < 2) lowSpend++;
        if (purchases === 0) noPurchase++;
      }
    }
    const order = ["MYR", "SGD"];
    const spentLabel =
      Object.entries(spentByCurrency)
        .sort((a, b) => {
          const ia = order.indexOf(a[0]);
          const ib = order.indexOf(b[0]);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
        .map(([cur, v]) => `${currencySymbol(cur)}${v.toFixed(2)}`)
        .join(" + ") || "RM0.00";
    return { spentLabel, totalPurchases, totalMsg, lowSpend, noPurchase };
  }, [data]);

  // Angle pie chart colors — cycle through palette
  const ANGLE_COLORS = [
    "#D4940A", "#A0825A", "#8B6D3F", "#E8A500", "#C4A87A",
    "#7c6e2f", "#4a7c59", "#8b5e3c", "#b08d57", "#6b8e6b",
  ];

  if (data.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Stat cards — row 1: content stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={String(data.length)} color="var(--accent)" />
        <StatCard
          label="Unique Live"
          value={String(uniqueLive)}
          color="#16a34a"
          icon="🟢"
        />
        {RANK_KEYS.filter((r) => r !== "NIL").map((r) => {
          const count = rankData.find((d) => d.rank === r)?.count || 0;
          return (
            <StatCard
              key={r}
              label={`Rank ${r}`}
              value={String(count)}
              color={RANKINGS[r].color}
            />
          );
        })}
      </div>

      {/* Stat cards — row 2: Meta Ads metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Spent"
          value={metaStats.spentLabel}
          color="var(--brand-brown)"
        />
        <StatCard
          label="Messaging Started"
          value={String(metaStats.totalMsg)}
          color="var(--brand-brown)"
        />
        <StatCard
          label="Total Purchases"
          value={String(metaStats.totalPurchases)}
          color="var(--accent)"
        />
        <StatCard
          label="Low Spend (<RM2)"
          value={String(metaStats.lowSpend)}
          color="#dc2626"
          subtitle="Live ads with < RM2 spent"
        />
        <StatCard
          label="No Purchase"
          value={String(metaStats.noPurchase)}
          color="#dc2626"
          subtitle="Live ads with 0 purchases"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rank distribution bar chart */}
        <ChartCard title="Rank Distribution">
          {rankData.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rankData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <XAxis dataKey="rank" tick={{ fontSize: 13 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value: unknown, _name: unknown, entry: unknown) => {
                    const v = value as number;
                    const e = entry as { payload?: { rank?: string } };
                    const rank = (e.payload?.rank || "NIL") as Ranking;
                    return [v, RANKINGS[rank]?.label || rank];
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {rankData.map((entry) => (
                    <Cell key={entry.rank} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Angle distribution pie chart */}
        <ChartCard title="Angle Distribution">
          {angleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={angleData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={renderPieLabel}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {angleData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={ANGLE_COLORS[i % ANGLE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  label,
  value,
  color,
  icon,
  subtitle,
}: {
  label: string;
  value: string;
  color: string;
  icon?: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
      <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {icon && <span className="mr-1 text-base">{icon}</span>}
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
      No data yet
    </div>
  );
}
