"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getActionButtonClass } from "./PageChrome";
import { useFeedback } from "./FeedbackProvider";
import type { WarehouseProduct, WarehouseBin } from "@/lib/warehouse";
import {
  buildProductSearchIndex,
  normalizeSearchText,
  scoreProductSearch,
} from "@/lib/productSearch";

type SortKey =
  | "brand"
  | "sku"
  | "product_name_cn"
  | "display_name"
  | "product_name_en"
  | "location"
  | "quantity"
  | "status"
  | "relevance";
const input =
  "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";
const statuses = ["全部", "OK", "低库存", "无库存", "缺少库位"];
const sortOptions: [SortKey, string][] = [
  ["brand", "品牌"],
  ["sku", "SKU"],
  ["product_name_cn", "中文名"],
  ["display_name", "展示名"],
  ["product_name_en", "英文名"],
  ["location", "库位"],
  ["quantity", "库存"],
  ["status", "状态"],
  ["relevance", "相关度"],
];
function statusClass(status: string) {
  return status === "无库存"
    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
    : status === "低库存"
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
      : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
}

export default function InventoryTable({
  products,
  bins,
}: {
  products: WarehouseProduct[];
  bins: WarehouseBin[];
}) {
  const params = useSearchParams(),
    router = useRouter(),
    { notify } = useFeedback();
  const [search, setSearch] = useState(params.get("q") || "");
  const [brand, setBrand] = useState(params.get("brand") || "全部");
  const [status, setStatus] = useState(
    statuses.includes(params.get("status") || "")
      ? params.get("status")!
      : "全部",
  );
  const [location, setLocation] = useState(params.get("location") || "");
  const [sort, setSort] = useState<SortKey>(() =>
    params.get("q")?.trim() ? "relevance" : "brand",
  );
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<WarehouseProduct | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const searchIndexes = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          buildProductSearchIndex(product),
        ]),
      ),
    [products],
  );
  const searchScores = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          scoreProductSearch(searchIndexes.get(product.id)!, search),
        ]),
      ),
    [products, searchIndexes, search],
  );
  const byProduct = useMemo(() => {
    const map = new Map<string, WarehouseBin[]>();
    for (const b of bins) {
      if (b.position !== null) {
        const group = map.get(b.product_id) || [];
        group.push(b);
        map.set(b.product_id, group);
      }
    }
    return map;
  }, [bins]);
  const stockOf = (id: string) => byProduct.get(id) || [];
  const available = (id: string) =>
    stockOf(id).reduce((n, b) => n + b.quantity - b.reserved, 0);
  const statusOf = (id: string) =>
    available(id) === 0
      ? "无库存"
      : !stockOf(id).length
        ? "缺少库位"
        : available(id) <= 3
          ? "低库存"
          : "OK";
  const brands = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "zh-Hans", { numeric: true }));
  function update(next: {
    q?: string;
    brand?: string;
    status?: string;
    location?: string;
  }) {
    const f = { q: search, brand, status, location, ...next };
    setSearch(f.q);
    setBrand(f.brand);
    setStatus(f.status);
    setLocation(f.location);
    if (next.q !== undefined) {
      setSort(next.q.trim() ? "relevance" : "brand");
      setDirection("asc");
    }
    const query = new URLSearchParams();
    if (f.q) query.set("q", f.q);
    if (f.brand !== "全部") query.set("brand", f.brand);
    if (f.status !== "全部") query.set("status", f.status);
    if (f.location) query.set("location", f.location);
    window.history.replaceState(
      null,
      "",
      query.size ? "/admin/inventory?" + query : "/admin/inventory",
    );
  }
  const rows = products
    .filter((p) => {
      return (
        (searchScores.get(p.id) || 0) > 0 &&
        (brand === "全部" || p.brand === brand) &&
        (status === "全部" || statusOf(p.id) === status) &&
        (!location ||
          stockOf(p.id).some((b) =>
            normalizeSearchText(b.location).includes(
              normalizeSearchText(location),
            ),
          ))
      );
    })
    .sort((a, b) => {
      const value = (p: WarehouseProduct) =>
        sort === "relevance"
          ? -(searchScores.get(p.id) || 0)
          : sort === "quantity"
            ? available(p.id)
            : sort === "status"
              ? statusOf(p.id)
              : sort === "location"
                ? stockOf(p.id)
                    .sort((a, b) => (a.position || 0) - (b.position || 0))
                    .map((b) => b.location)
                    .join(" ")
                : p[sort] || "";
      const av = value(a),
        bv = value(b);
      if (av === "" && bv !== "") return 1;
      if (av !== "" && bv === "") return -1;
      const result =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "zh-Hans", {
              numeric: true,
              sensitivity: "base",
            });
      return (
        (direction === "asc" ? result : -result) ||
        a.sku.localeCompare(b.sku, undefined, { numeric: true })
      );
    });
  function changeSort(key: SortKey) {
    if (sort === key) setDirection(direction === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDirection("asc");
    }
  }
  function heading(label: string, key: SortKey) {
    return (
      <button
        className="inline-flex items-center gap-1 whitespace-nowrap"
        onClick={() => changeSort(key)}
      >
        {label}
        <span className="text-xs text-gray-400">
          {sort === key ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }
  function locationCell(p: WarehouseProduct, position: number) {
    const group = stockOf(p.id).filter((b) => b.position === position);
    if (!group.length) return <span className="text-gray-400">—</span>;
    const total = group.reduce((n, b) => n + b.quantity - b.reserved, 0);
    const target =
      group.find((b) => b.quantity > b.reserved) ||
      group.find((b) => b.quantity > 0) ||
      group[0];
    return (
      <Link
        href={"/admin/warehouse?tab=stock_ops&bin=" + target.id}
        className="block hover:text-[var(--primary)]"
      >
        <span className="font-semibold">{group[0].location}</span>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {total} 个
        </span>
      </Link>
    );
  }
  function openOrder(p: WarehouseProduct) {
    setEditing(p);
    setOrder(
      Array.from(
        new Map(
          stockOf(p.id)
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((b) => [b.location, b]),
        ).keys(),
      ),
    );
  }
  async function saveOrder() {
    if (!editing) return;
    setBusy(true);
    try {
      const r = await fetch("/api/warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder_locations",
          payload: { productId: editing.id, locations: order },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "保存失败");
      notify({
        type: "success",
        title: "库位顺序已保存，后续拣货按此顺序出库",
      });
      setEditing(null);
      startRefresh(() => router.refresh());
    } catch (e) {
      notify({
        type: "error",
        title: "未能调整库位",
        message: e instanceof Error ? e.message : "请重试",
      });
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, delta: number) {
    const copy = [...order];
    [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
    setOrder(copy);
  }
  const actions = (p: WarehouseProduct) => (
    <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs font-semibold">
      <Link
        href={"/admin/warehouse?tab=stock_ops&product=" + p.id}
        className="text-[var(--primary)]"
      >
        上架 / 补货
      </Link>
      {stockOf(p.id).length > 0 && (
        <button className="text-[var(--primary)]" onClick={() => openOrder(p)}>
          库位顺序
        </button>
      )}
    </div>
  );
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            搜索商品
            <input
              className={input + " mt-1"}
              placeholder="SKU / 品名 / 拼音 / 首字母，如 tgy"
              value={search}
              onChange={(e) => update({ q: e.target.value })}
            />
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              支持拼音、首字母及近似拼写，准确匹配优先。
            </span>
          </label>
          <label className="text-sm">
            品牌
            <select
              className={input + " mt-1"}
              value={brand}
              onChange={(e) => update({ brand: e.target.value })}
            >
              <option>全部</option>
              {brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            搜索库位
            <input
              className={input + " mt-1"}
              placeholder="查找任一库位"
              value={location}
              onChange={(e) => update({ location: e.target.value })}
            />
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm">库存状态</legend>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <button
                type="button"
                aria-pressed={status === s}
                key={s}
                onClick={() => update({ status: s })}
                className={
                  "min-h-10 rounded-full border px-3 text-sm " +
                  (status === s
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-700")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            当前显示 {rows.length} 个商品，总库存{" "}
            {rows.reduce((n, p) => n + available(p.id), 0)} · 按库位 1 → 2 → 3
            出库
          </p>
          <button
            className={getActionButtonClass()}
            type="button"
            onClick={() =>
              update({ q: "", brand: "全部", status: "全部", location: "" })
            }
          >
            清空筛选
          </button>
        </div>
      </form>
      <div className="space-y-3 md:hidden">
        <div className="flex items-end gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <label className="flex-1 text-sm">
            排序
            <select
              className={input + " mt-1"}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey);
                setDirection("asc");
              }}
            >
              {sortOptions.map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={getActionButtonClass()}
            onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
          >
            {direction === "asc" ? "升序" : "降序"}
          </button>
        </div>
        {rows.map((p) => (
          <article
            key={p.id}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">
                  {p.brand} · {p.sku}
                </p>
                <h2 className="mt-1 font-semibold">
                  {p.display_name || p.product_name_cn}
                </h2>
              </div>
              <div className="text-right">
                <strong className="text-xl">{available(p.id)}</strong>
                <span
                  className={
                    "mt-1 block rounded px-2 py-1 text-xs " +
                    statusClass(statusOf(p.id))
                  }
                >
                  {statusOf(p.id)}
                </span>
              </div>
            </div>
            <div className="my-3 grid grid-cols-3 divide-x divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {[1, 2, 3].map((pos) => (
                <div key={pos} className="min-w-0 p-2 text-sm">
                  <p className="mb-1 text-xs text-gray-500">库位 {pos}</p>
                  {locationCell(p, pos)}
                </div>
              ))}
            </div>
            {actions(p)}
          </article>
        ))}
        {!rows.length && (
          <p className="p-6 text-center text-gray-500">没有符合条件的库存</p>
        )}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 md:block">
        <table className="w-full min-w-[1250px] text-sm">
          <thead className="bg-gray-100 text-left dark:bg-gray-800">
            <tr>
              {sortOptions.slice(0, 5).map(([key, label]) => (
                <th
                  key={key}
                  className="border-b border-gray-200 p-3 dark:border-gray-700"
                >
                  {heading(label, key)}
                </th>
              ))}
              {[1, 2, 3].map((pos) => (
                <th
                  className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-700"
                  key={pos}
                >
                  库位 {pos}
                </th>
              ))}
              <th className="border-b border-gray-200 p-3 dark:border-gray-700">
                {heading("库存", "quantity")}
              </th>
              <th className="border-b border-gray-200 p-3 dark:border-gray-700">
                {heading("状态", "status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/70"
              >
                <td className="p-3">{p.brand || "—"}</td>
                <td className="whitespace-nowrap p-3 font-medium">
                  {p.sku}
                  <div className="mt-2">{actions(p)}</div>
                </td>
                <td className="p-3">{p.product_name_cn || "—"}</td>
                <td className="p-3">{p.display_name || "—"}</td>
                <td className="p-3 text-gray-500">
                  {p.product_name_en || "—"}
                </td>
                {[1, 2, 3].map((pos) => (
                  <td key={pos} className="min-w-24 p-3">
                    {locationCell(p, pos)}
                  </td>
                ))}
                <td className="p-3 font-semibold">
                  {available(p.id)}
                  {stockOf(p.id).some((b) => b.reserved > 0) && (
                    <span className="mt-1 block whitespace-nowrap text-xs font-normal text-gray-500">
                      占用 {stockOf(p.id).reduce((n, b) => n + b.reserved, 0)}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={
                      "inline-flex min-w-16 justify-center whitespace-nowrap rounded px-2 py-1 text-xs " +
                      statusClass(statusOf(p.id))
                    }
                  >
                    {statusOf(p.id)}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-500">
                  没有符合条件的库存
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-order-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5">
            <h2 id="location-order-title" className="text-xl font-bold">
              调整库位顺序
            </h2>
            <p className="mt-2 text-sm">
              {editing.sku} · {editing.display_name || editing.product_name_cn}
            </p>
            <p className="mb-4 mt-2 text-sm text-[var(--muted)]">
              从上到下依次出库，前面的库位用完后，再取后面的库位。有库存的库位不能移除。
            </p>
            <div className="space-y-2">
              {order.map((loc, index) => {
                const quantity = stockOf(editing.id)
                  .filter((b) => b.location === loc)
                  .reduce((n, b) => n + b.quantity, 0);
                return (
                  <div
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-soft)] p-3"
                    key={loc}
                  >
                    <span className="text-sm text-[var(--muted)]">
                      库位 {index + 1}
                    </span>
                    <strong className="flex-1">{loc}</strong>
                    <span className="text-sm">{quantity} 个</span>
                    <button
                      className={getActionButtonClass()}
                      aria-label={"上移 " + loc}
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className={getActionButtonClass()}
                      aria-label={"下移 " + loc}
                      disabled={busy || index === order.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </button>
                    {quantity === 0 && (
                      <button
                        className="text-xs text-red-600"
                        disabled={busy}
                        onClick={() => setOrder(order.filter((x) => x !== loc))}
                      >
                        移除空库位
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className={getActionButtonClass()}
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                取消
              </button>
              <button
                className={getActionButtonClass("primary")}
                disabled={busy || refreshing}
                onClick={saveOrder}
              >
                {busy ? "保存中…" : "保存顺序"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
