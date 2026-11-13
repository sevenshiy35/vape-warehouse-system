"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "./FeedbackProvider";
import { getActionButtonClass } from "./PageChrome";

type Candidate = {
  productId: string;
  quantity: number;
  unit: string;
  name: string;
};
export default function AddMatchedAiItemsButton({
  orderId,
  candidates,
}: {
  orderId: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const pending = candidates.filter((item) => !added.includes(item.productId));
  async function addAll() {
    if (!pending.length || busy) return;
    if (
      !(await confirm({
        title: "加入匹配成功的商品？",
        message: `将加入 ${pending.length} 个尚未在订单中的商品，请核对截图数量。`,
        confirmText: "确认加入",
      }))
    )
      return;
    setBusy(true);
    try {
      for (const item of pending) {
        const response = await fetch("/api/order-items/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            productId: item.productId,
            qty: item.quantity,
            unit: item.unit,
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(`${item.name}：${data.error || "加入失败"}`);
        setAdded((current) => [...current, item.productId]);
      }
      notify({ type: "success", title: "匹配商品已加入订单" });
    } catch (error) {
      notify({
        type: "error",
        title: "未全部加入，请检查",
        message: error instanceof Error ? error.message : "网络请求失败",
      });
    } finally {
      router.refresh();
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={addAll}
      disabled={busy || !pending.length}
      className={getActionButtonClass("success")}
    >
      {busy ? "加入中…" : `一键加入匹配商品 (${pending.length})`}
    </button>
  );
}
