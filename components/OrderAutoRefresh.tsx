"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function OrderAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [active, router]);
  return active ? (
    <p className="text-sm text-blue-600">正在识别截图，结果会自动刷新…</p>
  ) : null;
}
