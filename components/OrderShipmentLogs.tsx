"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Panel, getActionButtonClass } from "./PageChrome";
import type { WarehouseOrder } from "@/lib/warehouse";

const input =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function completionDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return dateFormatter.format(new Date(value));
}

export default function OrderShipmentLogs({
  orders,
}: {
  orders: WarehouseOrder[];
}) {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const shipments = useMemo(
    () =>
      orders
        .filter((order) => order.status === "completed")
        .map((order) => ({
          ...order,
          order_items: order.order_items.filter((item) => item.packed_qty > 0),
        }))
        .filter((order) => order.order_items.length > 0)
        .sort(
          (a, b) =>
            (Date.parse(b.updated_at || "") || 0) -
              (Date.parse(a.updated_at || "") || 0) ||
            b.order_no.localeCompare(a.order_no, undefined, { numeric: true }),
        ),
    [orders],
  );
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = shipments.filter((order) => {
    const text = [
      order.order_no,
      order.address,
      ...order.order_items.flatMap((item) => [
        item.sku_snapshot,
        item.display_name_snapshot,
        item.product_name_cn_snapshot,
      ]),
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!date || completionDate(order.updated_at) === date) &&
      terms.every((term) => text.includes(term))
    );
  });
  const total = visible.reduce(
    (sum, order) =>
      sum +
      order.order_items.reduce((count, item) => count + item.packed_qty, 0),
    0,
  );
  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">订单出库流水</h2>
        <p className="text-sm text-[var(--muted)]">
          {visible.length} 单 · 合计出库{" "}
          <strong className="text-[var(--foreground)]">{total}</strong> 个
        </p>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        按完成时间倒序显示，每单列出商品及实际出库数量。时间为纽约时间。
      </p>
      <div className="my-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          搜索订单或商品
          <input
            className={input}
            value={search}
            placeholder="订单号 / 地址 / SKU / 商品名称"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="text-sm sm:w-44">
          完成日期
          <input
            className={input}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            onInput={(event) => setDate(event.currentTarget.value)}
          />
        </label>
        {(search || date) && (
          <button
            type="button"
            className={getActionButtonClass()}
            onClick={() => {
              setSearch("");
              setDate("");
            }}
          >
            清空筛选
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--border-soft)]">
        <table className="w-full table-fixed text-sm" aria-label="订单出库明细">
          <colgroup>
            <col className="hidden md:table-column md:w-36" />
            <col className="w-[31%] md:w-[26%]" />
            <col />
            <col className="w-12 sm:w-20" />
          </colgroup>
          <thead className="bg-[var(--background)] text-left text-xs text-[var(--muted)]">
            <tr>
              <th
                scope="col"
                className="hidden px-3 py-3 font-medium md:table-cell"
              >
                完成时间
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                订单
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                出库商品 / 数量
              </th>
              <th scope="col" className="px-1 py-3 text-center font-medium">
                合计
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {visible.map((order) => {
              const completedDate = completionDate(order.updated_at);
              const completedTime = completedDate
                ? timeFormatter.format(new Date(order.updated_at!))
                : "";
              const count = order.order_items.reduce(
                (sum, item) => sum + item.packed_qty,
                0,
              );
              return (
                <tr key={order.id} className="align-top">
                  <td className="hidden px-3 py-5 text-sm md:table-cell">
                    <p>{completedDate || "—"}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {completedTime}
                    </p>
                  </td>
                  <td className="break-words px-3 py-5">
                    <Link
                      className="whitespace-nowrap font-mono text-[11px] font-semibold text-[var(--primary)] underline underline-offset-2 sm:text-sm"
                      href={`/admin/orders/${order.id}`}
                    >
                      {order.order_no}
                    </Link>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      {order.address || "未填写地址"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)] md:hidden">
                      {completedDate} {completedTime}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <ul
                      className="divide-y divide-[var(--border-soft)]"
                      aria-label={`订单 ${order.order_no} 出库商品`}
                    >
                      {order.order_items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2 py-2"
                        >
                          <div className="min-w-0">
                            <p className="break-words font-medium leading-6">
                              {item.display_name_snapshot ||
                                item.product_name_cn_snapshot}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              {item.sku_snapshot}
                            </p>
                          </div>
                          <strong className="shrink-0 whitespace-nowrap leading-6 tabular-nums">
                            {item.packed_qty}
                            <span className="ml-0.5 text-xs font-normal">
                              个
                            </span>
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-1 py-5 text-center">
                    <strong className="text-lg tabular-nums">{count}</strong>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      个
                    </span>
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  {shipments.length
                    ? "没有符合条件的出库订单"
                    : "暂无已完成订单的出库记录"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
