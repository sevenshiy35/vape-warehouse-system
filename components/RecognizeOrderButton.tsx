"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/FeedbackProvider";
import { getActionButtonClass } from "./PageChrome";

export default function RecognizeOrderButton({
  orderId,
  status,
  aiStatus,
}: {
  orderId: string;
  status: string;
  aiStatus?: string | null;
}) {
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const [loading, setLoading] = useState(false);
  const allowed = ["uploaded", "need_review"].includes(status);
  const isRerun = aiStatus === "completed" || aiStatus === "failed";
  async function handleRecognize() {
    if (!allowed || loading || aiStatus === "processing") return;
    if (
      isRerun &&
      !(await confirm({
        title: "重新识别并匹配这个订单？",
        message:
          "系统会重新读取全部截图并匹配商品，结果显示在右侧。现有订单商品保留，请逐项核对后加入遗漏商品。",
        confirmText: "重新识别并匹配",
      }))
    )
      return;
    setLoading(true);
    try {
      const response = await fetch("/api/ai/recognize-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, force: isRerun }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "请重试");
      router.refresh();
      notify({ type: "success", title: "识别完成，请在右侧核对 AI 结果" });
    } catch (error) {
      notify({
        type: "error",
        title: "AI 识别失败",
        message: error instanceof Error ? error.message : "网络请求失败",
      });
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleRecognize}
      disabled={loading || !allowed || aiStatus === "processing"}
      className={getActionButtonClass()}
    >
      {loading || aiStatus === "processing"
        ? "识别中…"
        : isRerun
          ? "重新识别并匹配"
          : "AI 识别订单"}
    </button>
  );
}
