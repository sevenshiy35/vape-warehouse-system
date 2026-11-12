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
import OrderAutoRefresh from "@/components/OrderAutoRefresh";
import { warehouseStatus, type WarehouseItem } from "@/lib/warehouse";
import type { ProductWithInventory } from "@/lib/types";
import type { OrderRecognitionResult } from "@/lib/orderRecognition";
export const dynamic = "force-dynamic";
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
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!o) notFound();
  const editable = ["uploaded", "need_review"].includes(o.status);
  const { data: products, error: productError } = await supabaseAdmin
    .from("products")
    .select(
      "id,sku,brand,product_name_cn,display_name,product_name_en,inventory(shelf_location,quantity_on_hand)",
    )
    .eq("is_active", true)
    .order("sku");
  if (productError) throw new Error(productError.message);
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
  return (
    <PageShell maxWidth="max-w-7xl">
      <PageHeader
        title={o.order_no}
        description={
          o.business_date + " · " + (warehouseStatus[o.status] || o.status)
        }
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
      <div className="space-y-5">
        <Panel>
          <h2 className="text-xl font-bold">订单信息</h2>
          <p className="mt-3">
            {o.customer_name} {o.address}
          </p>
          {o.note && <p className="mt-2 text-orange-600">备注：{o.note}</p>}
          {editable && (
            <div className="mt-4">
              <EditOrderInfoButton
                orderId={id}
                status={o.status}
                currentCustomerName={o.customer_name}
                currentAddress={o.address}
                currentNote={o.note}
              />
            </div>
          )}
        </Panel>
        <OrderAutoRefresh
          active={o.ai_status === "processing" || o.ai_status === "not_started"}
        />
        <Panel>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              订单商品 · 共 {items.reduce((s, i) => s + i.pick_qty, 0)} 个
            </h2>
            {editable && o.ai_status !== "processing" && (
              <ConfirmOrderButton orderId={id} status={o.status} />
            )}
          </div>
          {items.length === 0 && (
            <p className="py-5 text-[var(--muted)]">
              尚无商品。等待识别，或在下方手动添加。
            </p>
          )}
          <div className="space-y-3">
            {items.map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border-soft)] p-4"
              >
                <div className="flex-1">
                  <p className="font-semibold">
                    {i.sku_snapshot} ·{" "}
                    {i.display_name_snapshot || i.product_name_cn_snapshot}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    截图数量 {i.recognized_qty} {i.recognized_unit} → 实拣{" "}
                    {i.pick_qty} 个
                  </p>
                </div>
                <strong className="text-3xl">{i.pick_qty}</strong>
                {editable && (
                  <>
                    <EditOrderItemButton
                      itemId={i.id}
                      orderStatus={o.status}
                      currentQty={i.recognized_qty}
                      currentUnit={i.recognized_unit}
                    />
                    <DeleteOrderItemButton
                      itemId={i.id}
                      orderStatus={o.status}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          {editable && (
            <div className="mt-5">
              <AddOrderItemForm
                orderId={id}
                orderStatus={o.status}
                products={(products || []) as ProductWithInventory[]}
              />
            </div>
          )}
        </Panel>
        {editable && (
          <Panel>
            <h2 className="mb-3 text-xl font-bold">截图识别</h2>
            {o.ai_error && <p className="mb-3 text-red-600">{o.ai_error}</p>}
            <RecognizeOrderButton
              orderId={id}
              status={o.status}
              aiStatus={o.ai_status}
            />
            {ai?.warnings?.map((w, i) => (
              <p key={i} className="mt-2 text-sm text-orange-600">
                {w}
              </p>
            ))}
            {ai?.items?.map((item, i) => (
              <div
                className="mt-3 rounded-xl border border-[var(--border-soft)] p-3"
                key={i}
              >
                <p>
                  {item.rawText} →{" "}
                  {item.displayName || item.productNameCN || item.productName} ·{" "}
                  {item.quantity} {item.unit}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.matchStatus === "not_found"
                    ? "未匹配：请在订单商品中手动添加对应 SKU"
                    : item.matchStatus === "need_review"
                      ? "候选商品：请核对后加入"
                      : "已匹配，请核对订单商品是否齐全"}
                </p>
                <ConfirmAiOrderItemButton
                  orderId={id}
                  orderStatus={o.status}
                  productId={item.productId}
                  productName={item.displayName || item.productName}
                  rawText={item.rawText}
                  quantity={item.quantity}
                  unit={item.unit}
                  matchStatus={item.matchStatus}
                  alreadyAdded={items.some(
                    (x) => x.product_id === item.productId,
                  )}
                />
              </div>
            ))}
          </Panel>
        )}
        <Panel>
          <div className="mb-4 flex flex-wrap justify-between gap-3">
            <h2 className="text-xl font-bold">原始订单截图</h2>
            {editable && (
              <AddOrderImagesButton orderId={id} status={o.status} />
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {images.map((img, i) =>
              img.url ? (
                <a
                  key={img.path}
                  href={img.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Image
                    unoptimized
                    src={img.url}
                    alt={"订单截图 " + (i + 1)}
                    width={900}
                    height={1400}
                    className="h-auto w-full rounded-xl border"
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
      </div>
    </PageShell>
  );
}
