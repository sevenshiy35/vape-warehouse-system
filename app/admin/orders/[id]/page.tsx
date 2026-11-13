import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  NavButton,
  PageHeader,
  PageShell,
  Panel,
} from "@/components/PageChrome";
import ConfirmOrderButton from "@/components/ConfirmOrderButton";
import RecognizeOrderButton from "@/components/RecognizeOrderButton";
import EditOrderInfoButton from "@/components/EditOrderInfoButton";
import AddOrderImagesButton from "@/components/AddOrderImagesButton";
import AddOrderItemForm from "@/components/AddOrderItemForm";
import EditOrderItemButton from "@/components/EditOrderItemButton";
import DeleteOrderItemButton from "@/components/DeleteOrderItemButton";
import ConfirmAiOrderItemButton from "@/components/ConfirmAiOrderItemButton";
import AddMatchedAiItemsButton from "@/components/AddMatchedAiItemsButton";
import OrderAutoRefresh from "@/components/OrderAutoRefresh";
import OrderInventoryStatus from "@/components/OrderInventoryStatus";
import RefreshOrderInventoryButton from "@/components/RefreshOrderInventoryButton";
import { warehouseStatus, type WarehouseItem } from "@/lib/warehouse";
import {
  forecastOrderInventory,
  recognitionPickQuantity,
} from "@/lib/orderInventory";
import type { OrderRecognitionResult } from "@/lib/orderRecognition";

export const dynamic = "force-dynamic";

async function readReviewProducts() {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        "id,sku,brand,product_name_cn,display_name,product_name_en,is_active,default_pick_multiplier,carton_pick_multiplier,inventory_bins(id,product_id,location,position,quantity,reserved)",
      )
      .order("sku")
      .range(start, start + 499);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: o, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id,order_no,customer_name,address,note,status,batch_id,business_date,image_path,image_paths,ai_status,ai_error,ai_raw_result,order_items(id,product_id,sku_snapshot,display_name_snapshot,product_name_cn_snapshot,recognized_qty,recognized_unit,pick_qty,packed_qty,match_status)",
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "order_items" })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!o) notFound();
  const editable = ["uploaded", "need_review"].includes(o.status);
  const canForecast =
    !o.batch_id && ["uploaded", "need_review", "confirmed"].includes(o.status);
  const products = await readReviewProducts();
  const byProduct = new Map(products.map((product) => [product.id, product]));
  const bins = products.flatMap((product) => product.inventory_bins);
  const pickerProducts = products
    .filter((product) => product.is_active)
    .map((product) => {
      const stock = product.inventory_bins
        .filter((bin) => bin.position !== null)
        .sort((a, b) => a.position! - b.position!);
      return {
        ...product,
        inventory: {
          shelf_location: stock.map((bin) => bin.location).join(" / ") || null,
          quantity_on_hand: stock.reduce(
            (sum, bin) => sum + bin.quantity - bin.reserved,
            0,
          ),
        },
      };
    });
  const paths: string[] = o.image_paths?.length
    ? o.image_paths
    : o.image_path
      ? [o.image_path]
      : [];
  const images = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabaseAdmin.storage
        .from("order-images")
        .createSignedUrl(path, 600);
      return { path, url: error ? null : data?.signedUrl };
    }),
  );
  const items = o.order_items as WarehouseItem[];
  const ai = o.ai_raw_result as Partial<OrderRecognitionResult> | null;
  const aiItems = ai?.items || [];
  const forecasts = forecastOrderInventory(
    items.map((item) => ({
      productId: byProduct.has(item.product_id) ? item.product_id : null,
      quantity: item.pick_qty,
    })),
    bins,
  );
  // AI rows describe the original screenshot, so forecast them separately from
  // the saved order rather than double-counting rows already added to it.
  const aiForecasts = forecastOrderInventory(
    aiItems.map((item) => ({
      productId:
        item.productId && byProduct.has(item.productId) ? item.productId : null,
      quantity: recognitionPickQuantity(
        item.quantity,
        item.unit,
        byProduct.get(item.productId || ""),
      ),
    })),
    bins,
  );
  const existingIds = new Set(items.map((item) => item.product_id));
  const candidates = aiItems
    .filter(
      (item) =>
        item.matchStatus === "matched" &&
        item.productId &&
        byProduct.get(item.productId)?.is_active &&
        !existingIds.has(item.productId) &&
        recognitionPickQuantity(
          item.quantity,
          item.unit,
          byProduct.get(item.productId),
        ) !== null,
    )
    .map((item) => ({
      productId: item.productId!,
      quantity: item.quantity,
      unit: item.unit,
      name: item.displayName || item.productName,
    }));
  const insufficient = forecasts.filter(
    (forecast) => forecast.status === "insufficient",
  ).length;
  const needsReview = forecasts.filter((forecast) =>
    ["unmatched", "needs_review"].includes(forecast.status),
  ).length;
  const checkedAt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  return (
    <PageShell maxWidth="max-w-[1600px]">
      <PageHeader
        title={o.order_no}
        description={`${o.business_date} · ${warehouseStatus[o.status] || o.status}`}
        actions={
          <>
            <NavButton href="/admin/warehouse?tab=orders">返回订单</NavButton>
            {o.batch_id && (
              <NavButton
                href={"/admin/warehouse?tab=batches&batch=" + o.batch_id}
                variant="primary"
              >
                进入作业批次
              </NavButton>
            )}
          </>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside aria-label="订单截图" className="min-w-0 lg:sticky lg:top-6">
          <Panel className="flex flex-col lg:max-h-[calc(100dvh-3rem)]">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">原始订单截图</h2>
              <p className="text-xs text-[var(--muted)]">
                共 {images.length} 张 · 点击查看原图
              </p>
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain rounded-xl max-lg:max-h-[65dvh]">
              {!images.length && (
                <p className="py-10 text-center text-[var(--muted)]">
                  还没有订单截图，请在右侧补充。
                </p>
              )}
              {images.map((img, index) =>
                img.url ? (
                  <a
                    key={img.path}
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <Image
                      unoptimized
                      src={img.url}
                      alt={`订单截图 ${index + 1}`}
                      width={900}
                      height={1400}
                      className="h-auto w-full rounded-xl border border-[var(--border-soft)]"
                    />
                  </a>
                ) : (
                  <p key={img.path} className="text-red-600">
                    截图暂时无法加载，请刷新重试。
                  </p>
                ),
              )}
            </div>
          </Panel>
        </aside>

        <div className="min-w-0 space-y-5" aria-label="订单审核与操作">
          <Panel>
            <h2 className="text-xl font-bold">订单信息与操作</h2>
            <p className="mt-3 break-words">
              {o.customer_name} {o.address}
            </p>
            {o.note && (
              <p className="mt-2 break-words text-orange-600">备注：{o.note}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {editable && (
                <>
                  <EditOrderInfoButton
                    orderId={id}
                    status={o.status}
                    currentCustomerName={o.customer_name}
                    currentAddress={o.address}
                    currentNote={o.note}
                  />
                  <AddOrderImagesButton orderId={id} status={o.status} />
                  <RecognizeOrderButton
                    orderId={id}
                    status={o.status}
                    aiStatus={o.ai_status}
                  />
                </>
              )}
              {canForecast && <RefreshOrderInventoryButton />}
              {editable && o.ai_status !== "processing" && (
                <ConfirmOrderButton
                  orderId={id}
                  status={o.status}
                  insufficientCount={insufficient}
                />
              )}
            </div>
            <div className="mt-3">
              <OrderAutoRefresh
                active={
                  o.ai_status === "processing" || o.ai_status === "not_started"
                }
              />
            </div>
            {o.ai_error && (
              <p className="mt-3 text-sm text-red-600">
                AI 识别失败：{o.ai_error}
              </p>
            )}
          </Panel>

          <Panel>
            <h2 className="text-xl font-bold">
              订单商品 · 共{" "}
              {items.reduce((sum, item) => sum + item.pick_qty, 0)} 个
            </h2>
            {canForecast ? (
              <div
                className="my-4 rounded-xl bg-[var(--background)] p-3 text-sm"
                aria-live="polite"
              >
                <p className="font-semibold">
                  {!items.length
                    ? "等待添加订单商品"
                    : insufficient || needsReview
                      ? `库存不足 ${insufficient} 项 · 待确认 ${needsReview} 项`
                      : "本单商品库存充足"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  库存核对时间 {checkedAt}（纽约时间）。按库位 1 → 2 → 3
                  预判，已扣除其他批次占用；生成批次时统一校验并占用库存。
                </p>
              </div>
            ) : (
              <p className="my-3 text-sm text-[var(--muted)]">
                {o.batch_id
                  ? "本单已进入批次，请在作业批次查看实际拣货与打包进度。"
                  : "订单已结束，以下保留订单商品记录。"}
              </p>
            )}
            {!items.length && (
              <p className="py-5 text-[var(--muted)]">
                尚无商品。等待识别，或手动添加。
              </p>
            )}
            {items.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[var(--border-soft)]">
                <table
                  className="w-full table-fixed text-sm"
                  aria-label="订单商品明细"
                >
                  <colgroup>
                    <col />
                    <col className="w-[18%]" />
                    {canForecast && <col className="w-[29%]" />}
                    {editable && <col className="w-11 sm:w-20" />}
                  </colgroup>
                  <thead className="bg-[var(--background)] text-xs text-[var(--muted)]">
                    <tr>
                      <th
                        scope="col"
                        className="px-3 py-3 text-left font-medium"
                      >
                        商品
                      </th>
                      <th
                        scope="col"
                        className="px-1 py-3 text-center font-medium"
                      >
                        实拣
                      </th>
                      {canForecast && (
                        <th
                          scope="col"
                          className="px-2 py-3 text-left font-medium"
                        >
                          库存
                          <span className="mt-0.5 block font-normal">
                            可用 → 剩余
                          </span>
                        </th>
                      )}
                      {editable && (
                        <th
                          scope="col"
                          className="px-1 py-3 text-center font-medium"
                        >
                          操作
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-soft)]">
                    {items.map((item, index) => (
                      <tr
                        key={item.id}
                        className="h-28 align-middle hover:bg-[var(--background)]/50"
                      >
                        <td className="break-words px-3 py-5">
                          <p className="font-semibold leading-6">
                            {item.display_name_snapshot ||
                              item.product_name_cn_snapshot}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {item.sku_snapshot}
                          </p>
                        </td>
                        <td className="px-1 py-5 text-center">
                          <p className="text-xl font-bold tabular-nums">
                            {item.pick_qty}
                            <span className="ml-0.5 text-xs font-normal">
                              个
                            </span>
                          </p>
                          <p className="mt-1 break-words text-xs text-[var(--muted)]">
                            原 {item.recognized_qty} {item.recognized_unit}
                          </p>
                        </td>
                        {canForecast && (
                          <td className="px-2 py-5">
                            <OrderInventoryStatus
                              forecast={forecasts[index]}
                              compact
                            />
                          </td>
                        )}
                        {editable && (
                          <td className="px-1 py-5">
                            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                              <EditOrderItemButton
                                itemId={item.id}
                                orderStatus={o.status}
                                currentQty={item.recognized_qty}
                                currentUnit={item.recognized_unit}
                              />
                              <DeleteOrderItemButton
                                itemId={item.id}
                                orderStatus={o.status}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {(editable || aiItems.length > 0) && (
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">AI 识别与库存匹配结果</h2>
                {editable &&
                  candidates.length > 0 &&
                  o.ai_status !== "processing" && (
                    <AddMatchedAiItemsButton
                      orderId={id}
                      candidates={candidates}
                    />
                  )}
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                对照左侧截图逐项核对。这里按 AI
                识别数量独立预判库存；已加入的商品以“订单商品”中的数量为准。
              </p>
              {ai?.warnings?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-orange-600 dark:text-orange-300">
                  {ai.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {!aiItems.length && (
                <p className="py-5 text-sm text-[var(--muted)]">
                  {o.ai_status === "processing"
                    ? "正在识别截图…"
                    : "暂无 AI 识别结果，可使用上方的识别按钮。"}
                </p>
              )}
              <div className="mt-4 space-y-3">
                {aiItems.map((item, index) => (
                  <article
                    key={index}
                    className="rounded-xl border border-[var(--border-soft)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold">
                          {item.rawText}
                        </p>
                        <p className="mt-1 break-words text-sm text-[var(--muted)]">
                          {item.sku || "未匹配 SKU"} ·{" "}
                          {item.displayName ||
                            item.productNameCN ||
                            item.productName}{" "}
                          · {item.quantity} {item.unit}
                        </p>
                        <p
                          className={`mt-2 text-xs font-semibold ${item.matchStatus === "matched" ? "text-green-700 dark:text-green-300" : "text-orange-600 dark:text-orange-300"}`}
                        >
                          {item.matchStatus === "matched"
                            ? "商品匹配成功"
                            : item.matchStatus === "need_review"
                              ? "候选商品，请人工确认"
                              : "未匹配，请手动选择商品"}
                        </p>
                      </div>
                      {editable && o.ai_status !== "processing" && (
                        <ConfirmAiOrderItemButton
                          orderId={id}
                          orderStatus={o.status}
                          productId={item.productId}
                          productName={item.displayName || item.productName}
                          rawText={item.rawText}
                          quantity={item.quantity}
                          unit={item.unit}
                          matchStatus={item.matchStatus}
                          alreadyAdded={existingIds.has(item.productId || "")}
                        />
                      )}
                    </div>
                    {canForecast && (
                      <OrderInventoryStatus forecast={aiForecasts[index]} />
                    )}
                    <details className="mt-3 text-xs text-[var(--muted)]">
                      <summary className="cursor-pointer">匹配说明</summary>
                      <p className="mt-2 break-words">
                        {item.matchReason || "请核对截图中的品牌、商品及数量。"}
                      </p>
                      {item.secondChoice && (
                        <p className="mt-1">
                          第二候选：{item.secondChoice.sku} ·{" "}
                          {item.secondChoice.name}
                        </p>
                      )}
                    </details>
                  </article>
                ))}
              </div>
            </Panel>
          )}

          {editable && (
            <details className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 md:p-5">
              <summary className="cursor-pointer text-lg font-semibold">
                手动添加商品
              </summary>
              <div className="mt-4">
                <AddOrderItemForm
                  orderId={id}
                  orderStatus={o.status}
                  products={pickerProducts}
                />
              </div>
            </details>
          )}
        </div>
      </div>
    </PageShell>
  );
}
