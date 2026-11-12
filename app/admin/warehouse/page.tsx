import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isWarehouseAdmin } from "@/lib/warehouseAuth";
import { PageHeader, PageShell, NavButton } from "@/components/PageChrome";
import WarehouseClient from "@/components/WarehouseClient";
import type {
  WarehouseProduct,
  WarehouseBin,
  WarehouseOrder,
  WarehouseBatch,
  WarehouseLine,
} from "@/lib/warehouse";

export const dynamic = "force-dynamic";
async function readAll(table: string, select: string, order: string) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const query = supabaseAdmin
      .from(table)
      .select(select)
      .order(order)
      .range(start, start + 499);
    if (table === "inventory_bins") query.not("position", "is", null);
    const { data, error } = await query;
    if (error) throw new Error(`读取仓库失败：${error.message}`);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    batch?: string;
    bin?: string;
    product?: string;
  }>;
}) {
  if (!(await isWarehouseAdmin())) redirect("/login?next=/admin/warehouse");
  const sp = await searchParams;
  if (sp.tab === "stock") redirect("/admin/inventory");
  const [products, bins, orders, batches, lines, events] = await Promise.all([
    readAll(
      "products",
      "id,sku,brand,product_name_cn,display_name,product_name_en,default_pick_multiplier,carton_pick_multiplier",
      "sku",
    ),
    readAll("inventory_bins", "*", "position"),
    readAll(
      "orders",
      "id,order_no,customer_name,address,note,status,business_date,batch_id,created_at,ai_status,order_items(id,product_id,sku_snapshot,display_name_snapshot,product_name_cn_snapshot,recognized_qty,recognized_unit,pick_qty,packed_qty,match_status)",
      "created_at",
    ),
    readAll("pick_batches", "*", "created_at"),
    readAll("batch_lines", "*", "id"),
    supabaseAdmin
      .from("warehouse_events")
      .select(
        "id,action,quantity,note,created_at,products(sku),inventory_bins(location)",
      )
      .order("created_at", { ascending: false })
      .limit(80),
  ]);
  if (events.error) throw new Error(events.error.message);
  return (
    <PageShell maxWidth="max-w-7xl">
      <PageHeader
        title="仓库作业台"
        description="截图录单 · 集中拣货 · 按单分货打包"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/upload" variant="primary">
              上传订单截图
            </NavButton>
            <NavButton href="/admin/products/new">添加商品</NavButton>
          </>
        }
      />
      <WarehouseClient
        products={products as unknown as WarehouseProduct[]}
        bins={bins as unknown as WarehouseBin[]}
        orders={orders as unknown as WarehouseOrder[]}
        batches={batches as unknown as WarehouseBatch[]}
        lines={lines as unknown as WarehouseLine[]}
        events={events.data || []}
        initialTab={sp.tab || "orders"}
        initialBatch={sp.batch || ""}
        initialBin={sp.bin || ""}
        initialProduct={sp.product || ""}
      />
    </PageShell>
  );
}
