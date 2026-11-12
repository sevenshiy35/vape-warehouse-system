import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PageShell, PageHeader, NavButton } from "@/components/PageChrome";
import InventoryTable from "@/components/InventoryTable";
import type { WarehouseProduct, WarehouseBin } from "@/lib/warehouse";
export const dynamic = "force-dynamic";
async function readStockTable(table: string, select: string) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const query = supabaseAdmin
      .from(table)
      .select(select)
      .order(table === "products" ? "sku" : "id")
      .range(start, start + 499);
    if (table === "inventory_bins") query.not("position", "is", null);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export default async function InventoryPage() {
  const [products, bins] = await Promise.all([
    readStockTable(
      "products",
      "id,sku,brand,product_name_cn,display_name,product_name_en,default_pick_multiplier,carton_pick_multiplier",
    ),
    readStockTable("inventory_bins", "*"),
  ]);
  return (
    <PageShell maxWidth="max-w-[1600px]">
      <PageHeader
        title="库存列表"
        description="同一商品一行，最多三个库位。拣货按库位 1 → 2 → 3 的顺序出库。"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/warehouse?tab=orders">订单列表</NavButton>
            <NavButton href="/admin/warehouse?tab=stock_ops" variant="primary">
              盘点上架 / 补货
            </NavButton>
            <NavButton href="/admin/products/new">添加商品</NavButton>
            <NavButton href="/admin/warehouse?tab=logs">作业流水</NavButton>
          </>
        }
      />
      <InventoryTable
        products={products as unknown as WarehouseProduct[]}
        bins={bins as unknown as WarehouseBin[]}
      />
    </PageShell>
  );
}
