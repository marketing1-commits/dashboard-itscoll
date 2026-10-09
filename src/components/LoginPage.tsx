"use client";
import { useState } from "react";

export default function LoginPage({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 shadow-lg"
      >
        <div className="flex justify-center mb-4">
          <img src="/logo.jpg" alt="itsColl" className="h-12 w-auto" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1 text-center">
          Content Dashboard
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center">
          itsColl Wellness
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
          用户名
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] mb-4 outline-none focus:border-[var(--accent)]"
          autoFocus
        />

        <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
          密码
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] mb-6 outline-none focus:border-[var(--accent)]"
        />

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full bg-[var(--accent)] text-white font-medium rounded-lg py-2.5 hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
    </div>
  );
}
