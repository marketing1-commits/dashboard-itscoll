"use client";
import { useState } from "react";
import { currencySymbol } from "@/lib/metaRange";

type Props = {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onDone: () => void;
};

type BrandReport = {
  brand: string;
  accounts: { account: string; ok: boolean; currency?: string; rows?: number; reason?: string }[];
  adsMatched: number;
  contentWithData: number;
  contentWithAds?: number;
  unmatched: { adName: string; spend: string; currency: string }[];
};

type SyncResult = {
  ok: boolean;
  error?: string;
  syncedAt?: string;
  since?: string;
  until?: string;
  dailyRows?: number;
  brands?: BrandReport[];
};

// Master-only "Sync Meta" button with a report of what matched and what didn't.
export default function MetaSync({ authFetch, onDone }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const res = await authFetch("/api/meta/sync", { method: "POST" });
      const json: SyncResult = await res.json().catch(() => ({
        ok: false,
        error: `HTTP ${res.status}`,
      }));
      setResult(json);
      if (json.ok) onDone();
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "网络错误" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <button
        onClick={run}
        disabled={running}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition disabled:opacity-50"
      >
        {running ? "同步中…" : "🔄 Sync Meta"}
      </button>

      {result && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {result.ok ? "Meta 同步完成" : "Meta 同步失败"}
              </h2>
              <button
                onClick={() => setResult(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-5 text-sm">
              {!result.ok && <p className="text-red-500">{result.error}</p>}

              {result.ok && (
                <p className="text-[var(--text-secondary)]">
                  同步了 {result.since} 到 {result.until}，写入{" "}
                  <b className="text-[var(--text-primary)]">{result.dailyRows}</b> 行每日数据
                </p>
              )}

              {result.brands?.map((b) => (
                <div key={b.brand} className="space-y-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">{b.brand}</h3>

                  {b.accounts.map((a) => (
                    <p key={a.account} className="text-xs">
                      <span className="font-mono text-[var(--text-secondary)]">{a.account}</span>{" "}
                      {a.ok ? (
                        <span className="text-green-600">
                          ✓ {a.rows} 行（{a.currency}）
                        </span>
                      ) : (
                        <span className="text-red-500">✗ {a.reason}</span>
                      )}
                    </p>
                  ))}

                  <p className="text-xs text-[var(--text-secondary)]">
                    配对成功 {b.adsMatched} 个广告 → {b.contentWithData} 条 content 有数据
                    {b.contentWithAds !== undefined && `，${b.contentWithAds} 条 content 有开广告`}
                  </p>

                  {b.unmatched.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--accent)]">
                        {b.unmatched.length} 个有花钱的广告没配对到（名字对不上）
                      </summary>
                      <ul className="mt-2 space-y-1 pl-3">
                        {b.unmatched.map((u, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="text-[var(--text-primary)] break-all">{u.adName}</span>
                            <span className="text-[var(--text-secondary)] whitespace-nowrap">
                              {currencySymbol(u.currency)}{u.spend}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
