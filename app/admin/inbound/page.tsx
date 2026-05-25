import { supabaseAdmin } from '@/lib/supabaseAdmin'
import InboundForm from '@/components/InboundForm'
import { NavButton, PageHeader, PageShell } from '@/components/PageChrome'
import type { ProductWithInventory } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminInboundPage() {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      sku,
      brand,
      product_name_cn,
      product_name_en,
      display_name,
      inventory (
        shelf_location,
        quantity_on_hand
      )
    `)
    .eq('is_active', true)
    .order('brand', { ascending: true })
    .order('sku', { ascending: true })

  if (error) {
    return (
      <PageShell maxWidth="max-w-4xl">
        <PageHeader title="入库" />
        <p className="text-red-600 dark:text-red-400">
          读取商品失败：{error.message}
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell maxWidth="max-w-4xl">
      <PageHeader
        title="入库"
        description="选择商品，输入入库数量，系统会自动增加库存并写入流水。"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/inventory">库存列表</NavButton>
            <NavButton href="/admin/logs">库存流水</NavButton>
          </>
        }
      />

        <InboundForm products={(products || []) as ProductWithInventory[]} />
    </PageShell>
  )
}
