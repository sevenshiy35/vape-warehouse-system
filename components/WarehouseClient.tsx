"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, StatCard, getActionButtonClass } from "./PageChrome";
import { useFeedback } from "./FeedbackProvider";
import {
  easternToday,
  warehouseStatus,
  type WarehouseProduct,
  type WarehouseBin,
  type WarehouseOrder,
  type WarehouseBatch,
  type WarehouseLine,
} from "@/lib/warehouse";

type Event = {
  id: string;
  action: string;
  quantity: number;
  note: string | null;
  created_at: string;
  products: unknown;
  inventory_bins: unknown;
};
type StockInput = {
  productId: string;
  location: string;
  quantity: number;
  mode: "set" | "add";
  note?: string;
  position?: number;
};
type Props = {
  products: WarehouseProduct[];
  bins: WarehouseBin[];
  orders: WarehouseOrder[];
  batches: WarehouseBatch[];
  lines: WarehouseLine[];
  events: Event[];
  initialTab: string;
  initialBatch: string;
  initialBin?: string;
  initialProduct?: string;
};
const input =
  "min-h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-base";
const actionLabels: Record<string, string> = {
  count: "盘点",
  inbound: "补货",
  pick: "拣货",
  return: "退回",
  pack: "打包完成",
  location_order: "库位顺序",
};
function displayRelation(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object"
    ? String((row as Record<string, unknown>)[key] || "")
    : "";
}

export default function WarehouseClient({
  products,
  bins,
  orders,
  batches,
  lines,
  events,
  initialTab,
  initialBatch,
  initialBin,
  initialProduct,
}: Props) {
  const initialRecord = bins.find((b) => b.id === initialBin);
  const initialProductId =
    initialRecord?.product_id || initialProduct || products[0]?.id || "";
  const firstFreePosition = (id: string) =>
    [1, 2, 3].find(
      (position) =>
        !bins.some((b) => b.product_id === id && b.position === position),
    ) || 1;
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const disabled = busy || refreshing;
  const [date, setDate] = useState(easternToday());
  const [allDates, setAllDates] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchName, setBatchName] = useState("集中拣货");
  const [brandFilter, setBrandFilter] = useState(() =>
    initialBin || initialProduct
      ? products.find((p) => p.id === initialProductId)?.brand?.trim() || "全部"
      : "全部",
  );
  const [productId, setProductId] = useState(initialProductId);
  const [location, setLocation] = useState(initialRecord?.location || "");
  const [position, setPosition] = useState(
    initialRecord?.position || firstFreePosition(initialProductId),
  );
  const [qty, setQty] = useState(initialRecord?.quantity || 0);
  const [mode, setMode] = useState<"set" | "add">("set");
  const [importRows, setImportRows] = useState<StockInput[]>([]);
  const [importError, setImportError] = useState("");
  const [pickQty, setPickQty] = useState<Record<string, number>>({});
  const [activeOrder, setActiveOrder] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const tab = ["orders", "stock_ops", "batches", "logs"].includes(initialTab)
    ? initialTab
    : "orders";
  const currentBatch =
    batches.find((b) => b.id === initialBatch) ||
    [...batches]
      .reverse()
      .find((b) => ["picking", "packing"].includes(b.status)) ||
    batches[batches.length - 1];
  const batchLines = lines
    .filter((l) => l.batch_id === currentBatch?.id)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.location.localeCompare(b.location, undefined, { numeric: true }) ||
        (productMap.get(a.product_id)?.sku || "").localeCompare(
          productMap.get(b.product_id)?.sku || "",
        ),
    );
  const batchOrders = orders.filter((o) => o.batch_id === currentBatch?.id);
  const packOrder =
    batchOrders.find((o) => o.id === activeOrder) ||
    batchOrders.find((o) => o.status !== "completed") ||
    batchOrders[0];
  const filteredOrders = orders
    .filter(
      (o) =>
        o.business_date === date ||
        (allDates && !["completed", "cancelled"].includes(o.status)),
    )
    .slice()
    .reverse();
  const readyOrders = filteredOrders.filter((o) => o.status === "confirmed");
  const selectedReady = selected.filter((id) =>
    readyOrders.some((o) => o.id === id),
  );
  const brandOptions = Array.from(
    new Set(products.map((p) => (p.brand || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "zh-Hans", { numeric: true }));
  const filteredProducts = products.filter(
    (p) => brandFilter === "全部" || (p.brand || "").trim() === brandFilter,
  );
  const productName = (id: string) => {
    const p = productMap.get(id);
    return p
      ? `${p.sku} · ${p.display_name || p.product_name_cn}`
      : "商品资料缺失";
  };
  async function command(action: string, payload: object, success = "已保存") {
    setBusy(true);
    try {
      const response = await fetch("/api/warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败");
      notify({ type: "success", title: success });
      startRefresh(() => router.refresh());
      return result as { id?: string; ok?: boolean };
    } catch (error) {
      notify({
        type: "error",
        title: "未完成操作",
        message: error instanceof Error ? error.message : "请重试",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function createBatch() {
    if (!selectedReady.length) return;
    if (
      !(await confirm({
        title: "生成集中拣货批次？",
        message: `共 ${selectedReady.length} 张订单。生成后商品明细将锁定，库存会被占用。`,
        confirmText: "生成批次",
      }))
    )
      return;
    const result = await command(
      "create_batch",
      {
        orderIds: selectedReady,
        requestId: crypto.randomUUID(),
        name: batchName,
        date,
      },
      "拣货批次已生成",
    );
    if (result?.id) {
      setSelected([]);
      router.push(`/admin/warehouse?tab=batches&batch=${result.id}`);
    }
  }
  async function importFile(file?: File) {
    setImportRows([]);
    setImportError("");
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        book.Sheets[book.SheetNames[0]],
        { defval: "" },
      );
      if (!rows.length || rows.length > 1000)
        throw new Error("请导入 1–1000 行数据");
      const keys = new Set<string>();
      const parsed = rows.map((row, index) => {
        const sku = String(row["SKU"] || row["sku"] || "").trim();
        const p = products.find(
          (p) => p.sku.toLowerCase() === sku.toLowerCase(),
        );
        const loc = String(row["库位"] || "")
          .trim()
          .toUpperCase();
        const count = Number(row["数量"]);
        const requestedPosition = String(row["库位序号"] || "").trim();
        if (requestedPosition && ![1, 2, 3].includes(Number(requestedPosition)))
          throw new Error(`第 ${index + 2} 行：库位序号只能是 1、2、3`);
        if (
          !p ||
          !loc ||
          String(row["数量"]).trim() === "" ||
          !Number.isSafeInteger(count) ||
          count < 0 ||
          count > 10000000
        )
          throw new Error(`第 ${index + 2} 行：请检查 SKU、库位及数量`);
        const key = `${p.id}/${loc}`;
        if (keys.has(key))
          throw new Error(`第 ${index + 2} 行：同一商品的库位重复`);
        keys.add(key);
        return {
          productId: p.id,
          ...(requestedPosition ? { position: Number(requestedPosition) } : {}),
          location: loc,
          quantity: count,
          mode: "set" as const,
          note: "批量盘点上架",
        };
      });
      setImportRows(parsed);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "表格读取失败");
    }
  }
  async function submitStock() {
    if (
      !(await confirm({
        title: mode === "set" ? "确认该库位盘点数量？" : "确认补货？",
        message: `${productName(productId)}，${location || "未填库位"}，数量 ${qty} 个。`,
        confirmText: "确认保存",
      }))
    )
      return;
    const result = await command("stock", {
      productId,
      position,
      location,
      quantity: qty,
      mode,
    });
    if (result) {
      setQty(0);
      setLocation("");
    }
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="待审核订单"
          value={
            orders.filter((o) => ["uploaded", "need_review"].includes(o.status))
              .length
          }
        />
        <StatCard
          label="待拣货订单"
          value={orders.filter((o) => o.status === "confirmed").length}
        />
        <StatCard
          label="作业中批次"
          value={
            batches.filter((b) => ["picking", "packing"].includes(b.status))
              .length
          }
        />
        <StatCard
          label="货架可用 / 待分货"
          value={`${bins.reduce((s, b) => s + b.quantity - b.reserved, 0)} / ${lines.reduce((s, l) => s + l.picked - l.returned, 0) - orders.reduce((s, o) => s + o.order_items.reduce((n, i) => n + i.packed_qty, 0), 0)}`}
        />
      </div>
      <nav aria-label="仓库功能" className="flex flex-wrap gap-2">
        {[
          ["orders", "订单审核"],
          ["batches", "集中拣货 / 分货打包"],
          ["stock", "库存列表"],
          ["stock_ops", "盘点上架 / 补货"],
          ["logs", "作业流水"],
        ].map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            className={getActionButtonClass(
              tab === key ? "primary" : "default",
            )}
            href={
              key === "stock"
                ? "/admin/inventory"
                : `/admin/warehouse?tab=${key}`
            }
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "orders" && (
        <Panel>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <label>
              业务日期
              <input
                aria-label="业务日期"
                className={input}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={allDates}
                onChange={(e) => setAllDates(e.target.checked)}
              />
              包含其他日期未结订单
            </label>
            <Link
              className={getActionButtonClass("primary")}
              href="/admin/upload"
            >
              批量上传截图
            </Link>
          </div>
          <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl bg-[var(--surface-soft)] p-4">
            <label className="grow">
              批次名称
              <input
                className={input}
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
              />
            </label>
            <button
              className={getActionButtonClass()}
              disabled={disabled || !readyOrders.length}
              onClick={() =>
                setSelected(
                  selectedReady.length === readyOrders.length
                    ? []
                    : readyOrders.map((o) => o.id),
                )
              }
            >
              全选待拣货订单
            </button>
            <button
              className={getActionButtonClass("primary")}
              disabled={disabled || !selectedReady.length || !batchName.trim()}
              onClick={createBatch}
            >
              生成拣货单（{selectedReady.length} 单）
            </button>
          </div>
          {!filteredOrders.length && (
            <p className="py-10 text-center text-[var(--muted)]">
              当天还没有订单。上传截图后，在订单详情核对商品并确认待拣货。
            </p>
          )}
          <div className="space-y-3">
            {filteredOrders.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-soft)] p-4"
              >
                <input
                  className="h-5 w-5"
                  type="checkbox"
                  aria-label={`选择订单 ${o.order_no}`}
                  disabled={disabled || o.status !== "confirmed"}
                  checked={selectedReady.includes(o.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, o.id]
                        : selected.filter((id) => id !== o.id),
                    )
                  }
                />
                <div className="min-w-48 flex-1">
                  <Link
                    className="font-bold text-[var(--primary)]"
                    href={`/admin/orders/${o.id}`}
                  >
                    {o.order_no}
                  </Link>
                  <span className="ml-3 text-sm text-[var(--muted)]">
                    {warehouseStatus[o.status] || o.status}
                    {o.ai_status === "processing" ? " · 识别中" : ""}
                  </span>
                  <p className="mt-1 text-sm">
                    {o.customer_name} {o.address}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {o.order_items.length} 种商品 ·{" "}
                    {o.order_items.reduce((s, i) => s + i.pick_qty, 0)} 个
                    {allDates ? ` · ${o.business_date}` : ""}
                  </p>
                </div>
                {["uploaded", "need_review"].includes(o.status) && (
                  <Link
                    className={getActionButtonClass()}
                    href={`/admin/orders/${o.id}`}
                  >
                    核对截图与商品
                  </Link>
                )}
                {o.status === "confirmed" && (
                  <button
                    disabled={disabled}
                    className={getActionButtonClass()}
                    onClick={() =>
                      command("review", { orderId: o.id }, "已退回审核")
                    }
                  >
                    退回修改
                  </button>
                )}
                {o.batch_id && (
                  <Link
                    className={getActionButtonClass()}
                    href={`/admin/warehouse?tab=batches&batch=${o.batch_id}`}
                  >
                    进入批次
                  </Link>
                )}
                {!o.batch_id &&
                  !["completed", "cancelled"].includes(o.status) && (
                    <button
                      disabled={disabled}
                      className={getActionButtonClass("quiet")}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: "取消这张订单？",
                            message: o.order_no,
                            confirmText: "取消订单",
                            tone: "danger",
                          })
                        )
                          await command(
                            "cancel_order",
                            { orderId: o.id },
                            "订单已取消",
                          );
                      }}
                    >
                      取消
                    </button>
                  )}
              </div>
            ))}
          </div>
        </Panel>
      )}
      {tab === "stock_ops" && (
        <>
          <Panel>
            <h2 className="mb-4 text-xl font-bold">盘点上架与补货</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">
              最多三个库位，按库位 1 → 2 → 3
              出库。直接填写该库位的实际数量；盘点设定数量，补货增加数量。
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                品牌筛选
                <select
                  className={input}
                  value={brandFilter}
                  onChange={(e) => {
                    setBrandFilter(e.target.value);
                    setProductId("");
                    setLocation("");
                    setQty(0);
                    setPosition(1);
                  }}
                >
                  <option value="全部">全部品牌</option>
                  {brandOptions.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                商品
                <select
                  className={input}
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setPosition(firstFreePosition(e.target.value));
                    setLocation("");
                    setQty(0);
                  }}
                >
                  <option value="">请选择商品</option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brand} · {p.sku} ·{" "}
                      {p.display_name || p.product_name_cn}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                库位序号
                <select
                  className={input}
                  value={position}
                  onChange={(e) => setPosition(Number(e.target.value))}
                >
                  {[1, 2, 3].map((n) => (
                    <option value={n} key={n}>
                      库位 {n}（第 {n} 优先）
                    </option>
                  ))}
                </select>
              </label>
              <label>
                库位
                <input
                  className={input}
                  value={location}
                  placeholder="例如 A1-01"
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
              <label>
                库存数量
                <input
                  className={input}
                  type="number"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </label>
              <label>
                操作
                <select
                  className={input}
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "set" | "add")}
                >
                  <option value="set">盘点：设为实际数量</option>
                  <option value="add">补货：增加数量</option>
                </select>
              </label>
              <button
                className={getActionButtonClass("primary")}
                disabled={
                  disabled ||
                  !productId ||
                  !location.trim() ||
                  !Number.isInteger(qty) ||
                  qty < 0
                }
                onClick={submitStock}
              >
                保存 · 共 {qty} 个
              </button>
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-3 text-xl font-bold">表格批量盘点</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Excel / CSV 第一行填写：SKU、库位序号、库位、数量。库位序号可填
              1、2、3，留空自动分配。确认前可预览，整批保存失败会全部回滚。
            </p>
            <input
              aria-label="上传盘点表格"
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={disabled}
              onChange={(e) => importFile(e.target.files?.[0])}
            />
            <a
              className="ml-3 text-sm text-[var(--primary)] underline"
              href="/stock-template.csv"
              download
            >
              下载模板
            </a>
            {importError && (
              <p role="alert" className="mt-3 text-red-600">
                {importError}
              </p>
            )}
            {importRows.length > 0 && (
              <>
                <div className="my-4 max-h-72 overflow-auto rounded-xl border p-3">
                  {importRows.map((r, i) => (
                    <p key={i} className="py-1 text-sm">
                      {productName(r.productId)} · {r.location} · · 共{" "}
                      {r.quantity} 个
                    </p>
                  ))}
                </div>
                <button
                  className={getActionButtonClass("primary")}
                  disabled={disabled}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `确认导入 ${importRows.length} 行盘点？`,
                        message: "这些库位的数量将设为表格中的实际数量。",
                        confirmText: "确认导入",
                      })
                    ) {
                      if (
                        await command(
                          "import_stock",
                          { rows: importRows },
                          "批量盘点已保存",
                        )
                      )
                        setImportRows([]);
                    }
                  }}
                >
                  确认整批盘点
                </button>
              </>
            )}
          </Panel>
        </>
      )}
      {tab === "batches" && (
        <>
          <Panel>
            <label>
              选择作业批次
              <select
                className={`${input} mt-2`}
                value={currentBatch?.id || ""}
                onChange={(e) => {
                  setActiveOrder("");
                  setChecked([]);
                  router.push(
                    `/admin/warehouse?tab=batches&batch=${e.target.value}`,
                  );
                }}
              >
                {[...batches].reverse().map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.business_date} · {b.name} · {warehouseStatus[b.status]}
                  </option>
                ))}
              </select>
            </label>
            {!batches.length && (
              <p className="py-8 text-center text-[var(--muted)]">
                还没有批次。先审核订单，再选择订单生成集中拣货单。
              </p>
            )}
          </Panel>
          {currentBatch && (
            <Panel>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{currentBatch.name}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {currentBatch.business_date} ·{" "}
                    {warehouseStatus[currentBatch.status]} ·{" "}
                    {batchOrders.filter((o) => o.status === "completed").length}{" "}
                    / {batchOrders.length} 单完成
                  </p>
                </div>
                {["picking", "packing"].includes(currentBatch.status) && (
                  <button
                    disabled={disabled}
                    className={getActionButtonClass("warning")}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "退回余货并结束这个批次？",
                          message:
                            "已完成订单保留。未使用的已拣商品会按数量退回原库位；未完成订单恢复待拣货。请先把实物放回后确认。",
                          confirmText: "确认退回并结束",
                          tone: "danger",
                        })
                      )
                        await command(
                          "close_batch",
                          { batchId: currentBatch.id },
                          "余货已退回，未完成订单可重新组批",
                        );
                    }}
                  >
                    退回余货 / 结束批次
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {batchLines.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border-soft)] p-4"
                  >
                    <div className="min-w-24">
                      <p className="text-xs text-[var(--muted)]">
                        库位 {l.position}
                      </p>
                      <p className="text-3xl font-bold">{l.location}</p>
                    </div>
                    <div className="min-w-40 flex-1">
                      <p className="font-semibold">
                        {productName(l.product_id)}
                      </p>
                      <p className="mt-1">
                        应拣 <strong className="text-2xl">{l.requested}</strong>{" "}
                        个
                      </p>
                      {l.confirmed && (
                        <p
                          className={
                            l.picked < l.requested
                              ? "text-orange-600"
                              : "text-green-700"
                          }
                        >
                          已确认实拣 {l.picked} 个
                          {l.picked < l.requested
                            ? ` · 缺 ${l.requested - l.picked} 个`
                            : ""}
                          {l.returned ? ` · 已退回 ${l.returned} 个` : ""}
                        </p>
                      )}
                    </div>
                    {currentBatch.status === "picking" && !l.confirmed && (
                      <div className="flex items-end gap-2">
                        <label className="w-28">
                          实拣个数
                          <input
                            className={input}
                            type="number"
                            min="0"
                            max={l.requested}
                            step={1}
                            value={pickQty[l.id] ?? l.requested}
                            onChange={(e) =>
                              setPickQty({
                                ...pickQty,
                                [l.id]: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <button
                          disabled={
                            disabled ||
                            batchLines.some(
                              (previous) =>
                                previous.product_id === l.product_id &&
                                previous.position < l.position &&
                                !previous.confirmed,
                            )
                          }
                          className={getActionButtonClass("primary")}
                          onClick={async () => {
                            const actual = pickQty[l.id] ?? l.requested;
                            if (
                              await confirm({
                                title:
                                  actual < l.requested
                                    ? "按缺货数量确认？"
                                    : "确认已从该库位取货？",
                                message: `${l.location} · ${productName(l.product_id)} · 实拣 ${actual} 个。确认后从库位转入批次待分货区。`,
                                confirmText: "确认实拣",
                              })
                            )
                              await command(
                                "pick",
                                { lineId: l.id, quantity: actual },
                                "实拣已记录",
                              );
                          }}
                        >
                          确认
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {currentBatch.status === "picking" && (
                <button
                  className={`${getActionButtonClass("primary")} mt-5`}
                  disabled={disabled || batchLines.some((l) => !l.confirmed)}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "集中拣货结束，开始按单分货？",
                        message: batchLines.some((l) => l.picked < l.requested)
                          ? "有缺货记录。系统会阻止不足的订单完成，其他完整订单可以继续打包。"
                          : "全部商品已拣好，接下来逐单核对打包。",
                        confirmText: "开始分货打包",
                      })
                    )
                      await command(
                        "start_packing",
                        { batchId: currentBatch.id },
                        "已进入分货打包",
                      );
                  }}
                >
                  拣货结束 → 按单分货打包
                </button>
              )}
            </Panel>
          )}
          {currentBatch &&
            ["packing", "completed"].includes(currentBatch.status) && (
              <Panel>
                <h2 className="mb-4 text-xl font-bold">按单分货打包</h2>
                <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                  <div className="flex flex-col gap-2">
                    {batchOrders.map((o) => (
                      <button
                        className={`${getActionButtonClass(o.id === packOrder?.id ? "primary" : "default")} justify-between`}
                        key={o.id}
                        onClick={() => {
                          setActiveOrder(o.id);
                          setChecked([]);
                        }}
                      >
                        {o.order_no}
                        <span className="ml-2 text-xs">
                          {o.status === "completed" ? "已完成" : "待打包"}
                        </span>
                      </button>
                    ))}
                  </div>
                  {packOrder && (
                    <div>
                      <div className="mb-4 rounded-xl bg-[var(--surface-soft)] p-4">
                        <p className="text-xl font-bold">
                          {packOrder.order_no}
                        </p>
                        <p className="mt-2">
                          {packOrder.customer_name} {packOrder.address}
                        </p>
                        {packOrder.note && (
                          <p className="mt-2 text-orange-600">
                            备注：{packOrder.note}
                          </p>
                        )}
                        <Link
                          className="mt-2 inline-block text-sm text-[var(--primary)] underline"
                          href={`/admin/orders/${packOrder.id}`}
                        >
                          查看订单原始截图
                        </Link>
                      </div>
                      <div className="space-y-3">
                        {packOrder.order_items.map((i) => {
                          const pool =
                            batchLines
                              .filter((l) => l.product_id === i.product_id)
                              .reduce((s, l) => s + l.picked - l.returned, 0) -
                            batchOrders.reduce(
                              (s, o) =>
                                s +
                                o.order_items
                                  .filter((x) => x.product_id === i.product_id)
                                  .reduce((n, x) => n + x.packed_qty, 0),
                              0,
                            );
                          return (
                            <label
                              key={i.id}
                              className="flex items-center gap-4 rounded-xl border border-[var(--border-soft)] p-4"
                            >
                              <input
                                className="h-6 w-6"
                                type="checkbox"
                                disabled={
                                  disabled || packOrder.status === "completed"
                                }
                                checked={
                                  packOrder.status === "completed" ||
                                  checked.includes(i.id)
                                }
                                onChange={(e) =>
                                  setChecked(
                                    e.target.checked
                                      ? [...checked, i.id]
                                      : checked.filter((id) => id !== i.id),
                                  )
                                }
                              />
                              <span className="flex-1">
                                <span className="font-semibold">
                                  {i.sku_snapshot} ·{" "}
                                  {i.display_name_snapshot ||
                                    i.product_name_cn_snapshot}
                                </span>
                                <span className="mt-1 block text-sm text-[var(--muted)]">
                                  原单 {i.recognized_qty} {i.recognized_unit} ·
                                  待分货剩余 {pool} 个
                                </span>
                              </span>
                              <strong className="text-3xl">
                                {i.pick_qty}
                                <span className="ml-1 text-sm font-normal">
                                  个
                                </span>
                              </strong>
                            </label>
                          );
                        })}
                      </div>
                      {packOrder.status !== "completed" && (
                        <button
                          className={`${getActionButtonClass("primary")} mt-5 w-full`}
                          disabled={
                            disabled ||
                            checked.length !== packOrder.order_items.length ||
                            !checked.length
                          }
                          onClick={async () => {
                            if (
                              await confirm({
                                title: "确认此订单已核对并打包？",
                                message: `${packOrder.order_no}，请确认包裹内商品与清单一致。`,
                                confirmText: "完成此单打包",
                              })
                            ) {
                              if (
                                await command(
                                  "pack",
                                  {
                                    orderId: packOrder.id,
                                    checkedItemIds: checked,
                                  },
                                  "此单打包完成",
                                )
                              ) {
                                setChecked([]);
                                setActiveOrder("");
                              }
                            }
                          }}
                        >
                          核对齐全，完成此单
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            )}
          {currentBatch?.status === "packing" && (
            <Panel>
              <h2 className="mb-3 text-xl font-bold">批次待分货余量</h2>
              {Array.from(new Set(batchLines.map((l) => l.product_id))).map(
                (id) => (
                  <p className="py-2" key={id}>
                    {productName(id)} ·{" "}
                    <strong>
                      {batchLines
                        .filter((l) => l.product_id === id)
                        .reduce((s, l) => s + l.picked - l.returned, 0) -
                        batchOrders.reduce(
                          (s, o) =>
                            s +
                            o.order_items
                              .filter((i) => i.product_id === id)
                              .reduce((n, i) => n + i.packed_qty, 0),
                          0,
                        )}
                    </strong>{" "}
                    个
                  </p>
                ),
              )}
            </Panel>
          )}
        </>
      )}
      {tab === "logs" && (
        <Panel>
          <h2 className="mb-4 text-xl font-bold">最近作业流水</h2>
          {!events.length && (
            <p className="py-8 text-center text-[var(--muted)]">
              重新盘点上架后，操作记录会显示在这里。
            </p>
          )}
          <div className="space-y-3">
            {events.map((e) => (
              <div
                className="flex flex-wrap justify-between gap-2 border-b border-[var(--border-soft)] py-3"
                key={e.id}
              >
                <div>
                  <p className="font-semibold">
                    {actionLabels[e.action] || e.action} ·{" "}
                    {displayRelation(e.products, "sku")} ·{" "}
                    {displayRelation(e.inventory_bins, "location")}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{e.note}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(e.created_at).toLocaleString("zh-CN", {
                      timeZone: "America/New_York",
                    })}{" "}
                    ET
                  </p>
                </div>
                <strong>
                  {e.quantity > 0 ? "+" : ""}
                  {e.quantity}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
