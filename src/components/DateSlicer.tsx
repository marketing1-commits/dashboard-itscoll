"use client";

type Props = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
};

const QUICK_RANGES = [
  { label: "Today", days: 0 },
  { label: "Last 7d", days: 7 },
  { label: "Last 14d", days: 14 },
  { label: "This Month", days: -1 },
  { label: "Last Month", days: -2 },
  { label: "All", days: -99 },
];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DateSlicer({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: Props) {
  const handleQuick = (days: number) => {
    const now = new Date();
    const to = formatDate(now);

    if (days === -99) {
      // All
      onDateFromChange("");
      onDateToChange("");
      return;
    }

    if (days === 0) {
      // Today
      onDateFromChange(to);
      onDateToChange(to);
      return;
    }

    if (days === -1) {
      // This month
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      onDateFromChange(formatDate(first));
      onDateToChange(to);
      return;
    }

    if (days === -2) {
      // Last month
      const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthEnd = new Date(firstThisMonth.getTime() - 86400000);
      const lastMonthStart = new Date(
        lastMonthEnd.getFullYear(),
        lastMonthEnd.getMonth(),
        1,
      );
      onDateFromChange(formatDate(lastMonthStart));
      onDateToChange(formatDate(lastMonthEnd));
      return;
    }

    // Last N days
    const from = new Date(now.getTime() - days * 86400000);
    onDateFromChange(formatDate(from));
    onDateToChange(to);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick range buttons */}
      <div className="flex gap-1">
        {QUICK_RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => handleQuick(r.days)}
            className="px-2.5 py-1 rounded-md text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition"
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Date inputs */}
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-xs text-[var(--text-secondary)]">From</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none"
        />
        <span className="text-xs text-[var(--text-secondary)]">To</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none"
        />
      </div>
    </div>
  );
}
