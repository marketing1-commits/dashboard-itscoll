"use client";
import { useState, useEffect, useCallback } from "react";
import { BRANDS, User } from "@/lib/config";
import { ContentTask } from "@/lib/types";

type Props = {
  user: User;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
};

const CONTENT_TYPES = ["Video", "Picture", "Carousel"];
const CREATORS = ["Kayson", "Lucas", "Eva"];

type TaskStatus = ContentTask["status"];

const STATUSES: TaskStatus[] = [
  "To Do",
  "In Progress",
  "Pending Review",
  "Complete",
];

const STATUS_CONFIG: Record<
  TaskStatus,
  { color: string; bg: string; icon: string }
> = {
  "To Do": { color: "#6b7280", bg: "#6b728015", icon: "⏳" },
  "In Progress": { color: "#D4940A", bg: "#D4940A15", icon: "🔵" },
  "Pending Review": { color: "#dc2626", bg: "#dc262615", icon: "🔴" },
  Complete: { color: "#4a7c59", bg: "#4a7c5915", icon: "✅" },
};

export default function ContentTaskPage({ user, authFetch }: Props) {
  const [tasks, setTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  // Form state
  const [brand, setBrand] = useState<string>(user.brand || "");
  const [contentType, setContentType] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState(
    user.role === "marketer" ? user.name : ""
  );
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/tasks");
      if (res.ok) {
        const json = await res.json();
        setTasks(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !contentType || !description || !dueDate || !assignee) return;
    setSubmitting(true);
    try {
      const res = await authFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          contentType,
          description,
          dueDate,
          assignee,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setBrand(user.brand || "");
        setContentType("");
        setDescription("");
        setDueDate("");
        setAssignee(user.role === "marketer" ? user.name : "");
        fetchTasks();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`创建失败：${err.error || res.status}`);
      }
    } catch (err) {
      alert(`创建失败：${err instanceof Error ? err.message : "网络错误"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.taskId === taskId ? { ...t, status } : t))
    );
    try {
      await authFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      fetchTasks(); // revert on failure
    }
  };

  const removeTask = async (taskId: string) => {
    if (!confirm("确定要删除这个 task 吗？")) return;
    const backup = tasks;
    setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    try {
      const res = await authFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) setTasks(backup);
    } catch {
      setTasks(backup);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (taskId: string) => {
    setDragging(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (status: TaskStatus) => {
    if (dragging) {
      updateStatus(dragging, status);
      setDragging(null);
    }
  };

  // Group tasks by status
  const grouped: Record<TaskStatus, ContentTask[]> = {
    "To Do": [],
    "In Progress": [],
    "Pending Review": [],
    Complete: [],
  };
  for (const t of tasks) {
    if (grouped[t.status]) {
      grouped[t.status].push(t);
    } else {
      grouped["To Do"].push(t);
    }
  }

  // Sort each column: overdue first, then by due date
  for (const status of STATUSES) {
    grouped[status].sort((a, b) => {
      if (status === "Complete") return 0;
      const now = new Date();
      const aOverdue = a.dueDate && new Date(a.dueDate + "T23:59:59") < now;
      const bOverdue = b.dueDate && new Date(b.dueDate + "T23:59:59") < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    });
  }

  const selectClass =
    "bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none";

  return (
    <div className="px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Content Tasks
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {tasks.length} tasks total
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[var(--accent)] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          ＋ Add Task
        </button>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          Loading...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUSES.map((status) => {
            const config = STATUS_CONFIG[status];
            const columnTasks = grouped[status];

            return (
              <div
                key={status}
                className="flex flex-col min-h-[300px]"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(status)}
              >
                {/* Column header */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl border border-b-0 border-[var(--border)]"
                  style={{ backgroundColor: config.bg }}
                >
                  <span className="text-sm">{config.icon}</span>
                  <span
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: config.color }}
                  >
                    {status}
                  </span>
                  <span
                    className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: config.color + "20",
                      color: config.color,
                    }}
                  >
                    {columnTasks.length}
                  </span>
                </div>

                {/* Column body */}
                <div
                  className={`flex-1 border border-[var(--border)] rounded-b-xl p-2 space-y-2 transition ${
                    dragging ? "bg-[var(--bg-hover)]" : "bg-[var(--bg-card)]/50"
                  }`}
                >
                  {columnTasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[var(--text-secondary)] opacity-60">
                      No tasks
                    </div>
                  ) : (
                    columnTasks.map((t) => (
                      <TaskCard
                        key={t.taskId}
                        task={t}
                        statuses={STATUSES}
                        onStatusChange={updateStatus}
                        onDragStart={handleDragStart}
                        onDelete={removeTask}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New task modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                New Content Task
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Brand <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  {(user.role === "master" ? BRANDS : [user.brand || BRANDS[0]]).map(
                    (b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBrand(b!)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          brand === b
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        {b}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Content Type <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  {CONTENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setContentType(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        contentType === t
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none resize-none focus:border-[var(--accent)]"
                  placeholder="要做什么内容..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Due Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`${selectClass} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Assign To <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className={`${selectClass} w-full`}
                  >
                    <option value="">Select</option>
                    {CREATORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  submitting ||
                  !brand ||
                  !contentType ||
                  !description ||
                  !dueDate ||
                  !assignee
                }
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- Task Card sub-component ---
function TaskCard({
  task,
  statuses,
  onStatusChange,
  onDragStart,
  onDelete,
}: {
  task: ContentTask;
  statuses: TaskStatus[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDragStart: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const isOverdue =
    task.status !== "Complete" &&
    task.dueDate &&
    new Date(task.dueDate + "T23:59:59") < new Date();

  // Assignee initials + color
  const initials = task.assignee
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const AVATAR_COLORS: Record<string, string> = {
    Kayson: "#D4940A",
    Lucas: "#4a7c59",
    Eva: "#8b5e3c",
  };
  const avatarColor = AVATAR_COLORS[task.assignee] || "#6b7280";

  // Format due date for display
  const formatDue = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDate();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${day} ${months[d.getMonth()]}`;
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.taskId)}
      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-[var(--accent)]/40 transition group"
    >
      {/* Top: brand tag */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] text-[var(--text-secondary)] truncate">
          {task.brand}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)]">•</span>
        <span className="text-[10px] text-[var(--text-secondary)]">
          {task.contentType}
        </span>
        <button
          type="button"
          onClick={() => onDelete(task.taskId)}
          title="Delete task"
          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-secondary)] hover:text-red-500 text-xs leading-none px-1"
        >
          🗑
        </button>
      </div>

      {/* Task name */}
      <p className="text-sm font-medium text-[var(--text-primary)] mb-3 leading-snug">
        {task.description}
      </p>

      {/* Bottom row: assignee + due date + status dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: avatarColor }}
            title={task.assignee}
          >
            {initials}
          </div>

          {/* Due date */}
          {task.dueDate && (
            <span
              className={`text-[11px] ${
                isOverdue
                  ? "text-red-500 font-semibold"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {isOverdue && "⚠ "}
              {formatDue(task.dueDate)}
            </span>
          )}
        </div>

        {/* Quick status change (visible on hover) */}
        <select
          value={task.status}
          onChange={(e) =>
            onStatusChange(task.taskId, e.target.value as TaskStatus)
          }
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-input)] border border-[var(--border)] rounded-md px-1.5 py-1 text-[10px] text-[var(--text-secondary)] outline-none cursor-pointer"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
