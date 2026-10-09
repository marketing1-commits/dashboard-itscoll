"use client";

export type NavPage =
  | "home"
  | "image"
  | "video"
  | "carousel"
  | "content-task"
  | "summary"
  | "all-content";

const NAV_ITEMS: { key: NavPage; label: string; icon: string }[] = [
  { key: "home", label: "Home", icon: "⌂" },
  { key: "image", label: "Image", icon: "🖼" },
  { key: "video", label: "Video", icon: "▶" },
  { key: "carousel", label: "Carousel", icon: "⧉" },
  { key: "content-task", label: "Content Task", icon: "✓" },
  { key: "summary", label: "Summary & Analysis", icon: "📊" },
  { key: "all-content", label: "All Content", icon: "☰" },
];

type Props = {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
};

export default function Sidebar({
  activePage,
  onNavigate,
  userName,
  userRole,
  onLogout,
}: Props) {
  return (
    <aside className="w-56 min-h-screen bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <img src="/logo.jpg" alt="itsColl" className="h-8 w-auto" />
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)] leading-tight">
              Content
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] leading-tight">
              Dashboard
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3">
        <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-2 mb-2">
          Menu
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition mb-0.5 ${
                isActive
                  ? "bg-[var(--accent)]/15 text-[var(--accent)] font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {userName}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)]">
              {userRole === "master" ? "Master" : "Marketer"}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}
