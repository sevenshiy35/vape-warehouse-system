import { supabaseAdmin } from '@/lib/supabaseAdmin'
import InventoryTable from '@/components/InventoryTable'
import { NavButton, PageHeader, PageShell } from '@/components/PageChrome'
import { getInventoryRecord, type ProductWithInventory } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminInventoryPage() {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      sku,
      brand,
      product_name_cn,
      display_name,
      product_name_en,
      inventory (
        shelf_location,
        quantity_on_hand,
        low_stock_threshold,
        updated_at
      )
    `)
    .order('brand', { ascending: true })
    .order('sku', { ascending: true })

  if (error) {
    return (
      <PageShell>
        <PageHeader title="库存列表" />
        <p className="text-red-600 dark:text-red-400">
          读取库存失败：{error.message}
        </p>
      </PageShell>
    )
  }

  const totalProducts = products?.length || 0

  const totalStock =
    (products as ProductWithInventory[] | null)?.reduce((sum, item) => {
      const inv = getInventoryRecord(item)

      return sum + Number(inv?.quantity_on_hand || 0)
    }, 0) || 0

  return (
    <PageShell>
      <PageHeader
        title="库存列表"
        description={`共 ${totalProducts} 个商品，总库存 ${totalStock}`}
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/location-move">库位挪动</NavButton>
            <NavButton href="/admin/products/new" variant="primary">
              添加新品
            </NavButton>
            <NavButton href="/admin/inbound">入库</NavButton>
            <NavButton href="/admin/correction">库存修正</NavButton>
            <NavButton href="/admin/logs">库存流水</NavButton>
          </>
        }
      />

      <InventoryTable products={(products || []) as ProductWithInventory[]} />
    </PageShell>
  )
}
