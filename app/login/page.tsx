"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function sanitizeNext(value: string | null) {
  if (!value) return "/admin/orders";

  // 只允许站内路径，防止跳转到外部恶意网站
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/admin/orders";
  }

  return value;
}

export default function LoginPage() {
  const router = useRouter();

  const [next, setNext] = useState("/admin/orders");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(sanitizeNext(params.get("next")));
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("密码错误，请重新输入");
        setLoading(false);
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("登录失败，请稍后再试");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl"
      >
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-500">
            Warehouse Admin
          </p>
          <h1 className="mt-2 text-2xl font-bold">后台登录</h1>
          <p className="mt-2 text-sm text-gray-400">
            请输入管理员密码后继续访问仓库系统。
          </p>
        </div>

        <label className="mb-2 block text-sm font-medium text-gray-300">
          管理员密码
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="输入密码"
          className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          autoFocus
        />

        {error && (
          <p className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
    </main>
  );
}