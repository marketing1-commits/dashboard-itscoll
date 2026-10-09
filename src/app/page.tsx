"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/useAuth";
import LoginPage from "@/components/LoginPage";
import Sidebar, { NavPage } from "@/components/Sidebar";
import DateSlicer from "@/components/DateSlicer";
import ContentTable from "@/components/ContentTable";
import NewContentForm from "@/components/NewContentForm";
import HomeOverview from "@/components/HomeOverview";
import ContentTaskPage from "@/components/ContentTaskPage";
import ContentPageStats from "@/components/ContentPageStats";
import MetaSync from "@/components/MetaSync";
import { ContentRecord } from "@/lib/types";
import type { DailyRow } from "@/lib/meta";
import { applyMetaRange, FirstAd } from "@/lib/metaRange";

export default function Home() {
  const { user, loading, login, logout, authFetch } = useAuth();
  const [data, setData] = useState<ContentRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [activePage, setActivePage] = useState<NavPage>("home");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Rows left after the table's own slicers (brand / creator / rank / layer / live)
  const [slicedData, setSlicedData] = useState<ContentRecord[]>([]);
  // Per-day Meta numbers, totalled for the selected date range below
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [firstAds, setFirstAds] = useState<FirstAd[]>([]);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await authFetch("/api/content");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, [authFetch]);

  const fetchDaily = useCallback(async () => {
    try {
      const res = await authFetch("/api/meta/daily");
      if (res.ok) {
        const json = await res.json();
        setDaily(json.rows || []);
        setFirstAds(json.ads || []);
      }
    } catch {
      // no Meta data yet — content still shows sheet values
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) {
      fetchData();
      fetchDaily();
    }
  }, [user, fetchData, fetchDaily]);

  // Content with Meta numbers totalled for the selected dates
  const dataWithMetrics = useMemo(
    () => applyMetaRange(data, daily, dateFrom, dateTo, firstAds),
    [data, daily, dateFrom, dateTo, firstAds],
  );

  // Parse date string from record (format: DDMMYY) to comparable value
  const parseRecordDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    // Try DDMMYY format
    if (/^\d{6}$/.test(dateStr)) {
      const d = parseInt(dateStr.slice(0, 2), 10);
      const m = parseInt(dateStr.slice(2, 4), 10) - 1;
      const y = 2000 + parseInt(dateStr.slice(4, 6), 10);
      return new Date(y, m, d);
    }
    // Try ISO or other parseable format
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // Filter data by content type and date range
  const filteredData = useMemo(() => {
    let result = dataWithMetrics;

    // Filter by content type based on active page
    if (activePage === "image") {
      result = result.filter((d) => d.contentType === "Picture");
    } else if (activePage === "video") {
      result = result.filter((d) => d.contentType === "Video");
    } else if (activePage === "carousel") {
      result = result.filter((d) => d.contentType === "Carousel");
    }
    // home, all-content, content-task, summary show all types

    // Filter by date range
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59") : null;

      result = result.filter((d) => {
        const recordDate = parseRecordDate(d.date);
        if (!recordDate) return true; // keep records without dates
        if (from && recordDate < from) return false;
        if (to && recordDate > to) return false;
        return true;
      });
    }

    return result;
  }, [dataWithMetrics, activePage, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={async (u, p) => {
          await login(u, p);
        }}
      />
    );
  }

  // Page titles
  const PAGE_TITLES: Record<NavPage, string> = {
    home: "Overview",
    image: "Image Content",
    video: "Video Content",
    carousel: "Carousel Content",
    "content-task": "Content Task",
    summary: "Summary & Analysis",
    "all-content": "All Content",
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex">
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        userName={user.name}
        userRole={user.role}
        onLogout={logout}
      />

      {/* Main area */}
      <div className="flex-1 min-h-screen overflow-auto">
        {/* Top bar */}
        <header className="bg-[var(--bg-card)] border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              {PAGE_TITLES[activePage]}
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {user.role === "master" ? "All Brands" : user.brand}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user.role === "master" && activePage !== "content-task" && (
              <MetaSync
                authFetch={authFetch}
                onDone={() => {
                  fetchData();
                  fetchDaily();
                }}
              />
            )}
            {activePage !== "content-task" && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                ＋ New content
              </button>
            )}
          </div>
        </header>

        {/* Date slicer — show on content pages (not home, not content-task) */}
        {activePage !== "home" && activePage !== "content-task" && activePage !== "summary" && (
          <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
            <DateSlicer
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
          </div>
        )}

        {/* Home overview with charts */}
        {activePage === "home" && (
          <HomeOverview data={data} user={user} />
        )}

        {/* Content Task page */}
        {activePage === "content-task" && (
          <ContentTaskPage user={user} authFetch={authFetch} />
        )}

        {/* Summary placeholder */}
        {activePage === "summary" && (
          <div className="px-6 py-12 text-center text-[var(--text-secondary)]">
            Summary & Analysis — Phase 2
          </div>
        )}

        {/* Table — show on all pages except content-task and summary */}
        {activePage !== "content-task" && activePage !== "summary" && (
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {activePage === "home" ? "Recent Content" : PAGE_TITLES[activePage]}
                <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
                  {activePage === "home"
                    ? `${Math.min(filteredData.length, 10)} of ${filteredData.length}`
                    : `${filteredData.length} records`}
                </span>
              </h2>
              {activePage === "home" && filteredData.length > 10 && (
                <button
                  onClick={() => setActivePage("all-content")}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  View all →
                </button>
              )}
            </div>

            {loadingData ? (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                Loading...
              </div>
            ) : (
              <ContentTable
                data={activePage === "home" ? filteredData.slice(0, 10) : filteredData}
                user={user}
                authFetch={authFetch}
                onRefresh={fetchData}
                onFilteredChange={setSlicedData}
              />
            )}

            {/* Stats section — content pages, follows the table's slicers */}
            {activePage !== "home" && !loadingData && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                  Analytics
                  <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
                    {slicedData.length} records in view
                  </span>
                </h2>
                <ContentPageStats data={slicedData} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* New content modal */}
      {showForm && (
        <NewContentForm
          user={user}
          authFetch={authFetch}
          onCreated={() => {
            setShowForm(false);
            fetchData();
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
