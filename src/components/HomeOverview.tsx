"use client";
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { ContentRecord } from "@/lib/types";
import { User } from "@/lib/config";

type Props = {
  data: ContentRecord[];
  user: User;
};

// itsColl brand palette
const COLORS = {
  video: "#D4940A",
  picture: "#A0825A",
  carousel: "#8B6D3F",
  gold: "#E8A500",
  accent: "#D4940A",
  layer1: "#D4940A",
  layer2: "#A0825A",
  layer3: "#C4A87A",
  noLayer: "#E0D5C3",
};

const BRAND_COLORS: Record<string, string> = {
  Oxygrainz: "#D4940A",
  FlexiGlo: "#A0825A",
  Multigrainz: "#8B6D3F",
};

const TYPE_COLORS: Record<string, string> = {
  Video: COLORS.video,
  Picture: COLORS.picture,
  Carousel: COLORS.carousel,
};

// Parse DDMMYY date string to Date
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (/^\d{6}$/.test(dateStr)) {
    const d = parseInt(dateStr.slice(0, 2), 10);
    const m = parseInt(dateStr.slice(2, 4), 10) - 1;
    const y = 2000 + parseInt(dateStr.slice(4, 6), 10);
    return new Date(y, m, d);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Format date for display
function fmtDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// Custom tooltip style
const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #E8DCC8",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#3D2E1C",
};

export default function HomeOverview({ data, user }: Props) {
  // --- This month filter ---
  const now = new Date();
  const thisMonthData = useMemo(() => {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return data.filter((d) => {
      const date = parseDate(d.date);
      return date && date >= startOfMonth && date <= now;
    });
  }, [data]);

  // --- Stats ---
  const totalThisMonth = thisMonthData.length;
  const videoCount = thisMonthData.filter((d) => d.contentType === "Video").length;
  const picCount = thisMonthData.filter((d) => d.contentType === "Picture").length;
  const carouselCount = thisMonthData.filter((d) => d.contentType === "Carousel").length;

  // All time stats for context
  const totalAll = data.length;

  // --- Pie chart: content type distribution ---
  const pieData = useMemo(() => {
    return [
      { name: "Video", value: videoCount },
      { name: "Picture", value: picCount },
      { name: "Carousel", value: carouselCount },
    ].filter((d) => d.value > 0);
  }, [videoCount, picCount, carouselCount]);

  // --- Bar chart: by brand ---
  const brandBarData = useMemo(() => {
    const map: Record<string, { Video: number; Picture: number; Carousel: number }> = {};
    thisMonthData.forEach((d) => {
      if (!map[d.brand]) map[d.brand] = { Video: 0, Picture: 0, Carousel: 0 };
      const ct = d.contentType as "Video" | "Picture" | "Carousel";
      if (map[d.brand][ct] !== undefined) map[d.brand][ct]++;
    });
    return Object.entries(map).map(([brand, counts]) => ({
      name: brand,
      Video: counts.Video,
      Picture: counts.Picture,
      Carousel: counts.Carousel,
    }));
  }, [thisMonthData]);

  // --- Bar chart: by creator ---
  const creatorBarData = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthData.forEach((d) => {
      map[d.creator] = (map[d.creator] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [thisMonthData]);

  // --- Line chart: daily trend this month ---
  const lineData = useMemo(() => {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayMap: Record<string, number> = {};

    // Pre-fill all days of the month up to today
    for (let d = new Date(startOfMonth); d <= now; d.setDate(d.getDate() + 1)) {
      dayMap[fmtDate(new Date(d))] = 0;
    }

    thisMonthData.forEach((d) => {
      const date = parseDate(d.date);
      if (date) {
        const key = fmtDate(date);
        if (dayMap[key] !== undefined) dayMap[key]++;
      }
    });

    return Object.entries(dayMap).map(([date, count]) => ({ date, count }));
  }, [thisMonthData]);

  // --- Layer/Grade distribution ---
  const layerData = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthData.forEach((d) => {
      const layer = d.layer || "No Layer";
      map[layer] = (map[layer] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        // Put Layer 1/2/3 in order, "No Layer" last
        if (a.name === "No Layer") return 1;
        if (b.name === "No Layer") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [thisMonthData]);

  const LAYER_COLORS = [COLORS.layer1, COLORS.layer2, COLORS.layer3, COLORS.noLayer];

  const monthName = now.toLocaleString("en", { month: "long", year: "numeric" });

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Month label */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {monthName} Overview
        </h2>
        <span className="text-xs text-[var(--text-secondary)]">
          All time: {totalAll} contents
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="This Month" value={totalThisMonth} color={COLORS.gold} sub="Total" />
        <StatCard label="Video" value={videoCount} color={COLORS.video} sub={`${totalThisMonth ? Math.round((videoCount / totalThisMonth) * 100) : 0}%`} />
        <StatCard label="Picture" value={picCount} color={COLORS.picture} sub={`${totalThisMonth ? Math.round((picCount / totalThisMonth) * 100) : 0}%`} />
        <StatCard label="Carousel" value={carouselCount} color={COLORS.carousel} sub={`${totalThisMonth ? Math.round((carouselCount / totalThisMonth) * 100) : 0}%`} />
      </div>

      {/* Charts row 1: Pie + Layer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie chart - content type */}
        <ChartCard title="Content Type Distribution">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={TYPE_COLORS[entry.name] || "#ccc"}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        {/* Pie chart - layer/grade */}
        <ChartCard title="Content Layer / Grade">
          {layerData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={layerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {layerData.map((_, i) => (
                    <Cell key={i} fill={LAYER_COLORS[i % LAYER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* Charts row 2: Brand bar + Creator bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bar chart - by brand */}
        <ChartCard title="Output by Brand">
          {brandBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={brandBarData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Video" fill={COLORS.video} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Picture" fill={COLORS.picture} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Carousel" fill={COLORS.carousel} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        {/* Bar chart - by creator */}
        <ChartCard title="Output by Creator">
          {creatorBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={creatorBarData} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  width={70}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={COLORS.accent} radius={[0, 4, 4, 0]} name="Content" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* Line chart - daily trend */}
      <ChartCard title="Daily Production Trend">
        {lineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                axisLine={{ stroke: "var(--border)" }}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="count"
                stroke={COLORS.accent}
                strokeWidth={2}
                dot={{ fill: COLORS.accent, r: 3 }}
                activeDot={{ r: 5 }}
                name="Content"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState />
        )}
      </ChartCard>
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  sub: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <div className="text-xs text-[var(--text-secondary)] mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-[var(--text-secondary)] mt-1">{sub}</div>
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
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[220px] text-sm text-[var(--text-secondary)]">
      No data this month
    </div>
  );
}
