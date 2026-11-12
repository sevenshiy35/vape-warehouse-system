"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "./FeedbackProvider";
import { getActionButtonClass } from "./PageChrome";
export default function ConfirmOrderButton({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter(),
    { confirm, notify } = useFeedback();
  async function ready() {
    if (
      !(await confirm({
        title: "已逐项核对截图与订单商品？",
        message:
          "请确认没有漏掉未识别的商品，数量和盒／条换算均正确。确认后订单进入待拣货队列；生成批次时才占用库存。",
        confirmText: "核对无误，待拣货",
      }))
    )
      return;
    setBusy(true);
    try {
      const r = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error);
      notify({ type: "success", title: "订单已进入待拣货队列" });
      router.push("/admin/warehouse?tab=orders");
    } catch (e) {
      notify({
        type: "error",
        title: "确认失败",
        message: e instanceof Error ? e.message : "请重试",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      className={getActionButtonClass("primary")}
      disabled={busy || !["uploaded", "need_review"].includes(status)}
      onClick={ready}
    >
      {busy ? "确认中…" : "核对无误 → 待拣货"}
    </button>
  );
}
