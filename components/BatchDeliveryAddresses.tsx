"use client";

import Link from "next/link";
import { useState } from "react";
import { Panel, getActionButtonClass } from "./PageChrome";
import { useFeedback } from "./FeedbackProvider";
import type { WarehouseOrder } from "@/lib/warehouse";

type DeliveryOrder = Pick<
  WarehouseOrder,
  "id" | "order_no" | "address" | "status"
>;

export default function BatchDeliveryAddresses({
  batchName,
  businessDate,
  orders,
}: {
  batchName: string;
  businessDate: string;
  orders: DeliveryOrder[];
}) {
  const { notify } = useFeedback();
  const [copying, setCopying] = useState(false);
  const addresses = orders
    .map((order) => order.address?.trim())
    .filter((address): address is string => Boolean(address));
  const completed = orders.filter(
    (order) => order.status === "completed",
  ).length;
  async function copyAddresses() {
    if (!addresses.length || copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(addresses.join("\n"));
      notify({
        type: "success",
        title: `已复制 ${addresses.length} 个订单地址`,
        message:
          addresses.length < orders.length
            ? `另有 ${orders.length - addresses.length} 单尚未填写地址。`
            : "每行一个地址，可粘贴后安排配送顺序。",
      });
    } catch {
      notify({
        type: "error",
        title: "未能复制地址",
        message: "请直接选中下方地址复制。",
      });
    } finally {
      setCopying(false);
    }
  }
  if (!orders.length) return null;
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">配送地址清单</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {businessDate} · {batchName} · 共 {orders.length} 单 · 已打包{" "}
            {completed} / {orders.length} 单
          </p>
        </div>
        <button
          type="button"
          className={getActionButtonClass("primary")}
          disabled={!addresses.length || copying}
          onClick={copyAddresses}
        >
          {copying ? "复制中…" : "复制全部地址"}
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        本批次所有订单地址汇总，方便安排 delivery 路线。
      </p>
      <ol
        className="mt-4 divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]"
        aria-label="本批次配送地址"
      >
        {orders.map((order, index) => (
          <li key={order.id} className="flex items-start gap-3 py-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-sm font-semibold tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`select-text whitespace-pre-wrap break-words text-base font-semibold leading-7 ${order.address?.trim() ? "" : "text-orange-600 dark:text-orange-300"}`}
              >
                {order.address?.trim() || "未填写地址，请先补充"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                <Link
                  className="text-[var(--primary)] underline underline-offset-2"
                  href={`/admin/orders/${order.id}`}
                >
                  订单 {order.order_no}
                </Link>
                <span
                  className={
                    order.status === "completed"
                      ? "text-green-700 dark:text-green-300"
                      : "text-orange-600 dark:text-orange-300"
                  }
                >
                  {order.status === "completed" ? "已打包" : "待打包"}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
