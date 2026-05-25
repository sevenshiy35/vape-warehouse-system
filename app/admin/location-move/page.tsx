import { supabaseAdmin } from '@/lib/supabaseAdmin'
import LocationMoveForm from '@/components/LocationMoveForm'
import { NavButton, PageHeader, PageShell } from '@/components/PageChrome'

export const dynamic = 'force-dynamic'

export default async function AdminLocationMovePage() {
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
        <PageHeader title="库位挪动" />
        <p className="text-red-600 dark:text-red-400">
          读取商品失败：{error.message}
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell maxWidth="max-w-4xl">
      <PageHeader
        title="库位挪动"
        description="用于调整商品库位，不改变库存数量，并记录库位变化流水。"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/inventory">库存列表</NavButton>
            <NavButton href="/admin/logs">库存流水</NavButton>
          </>
        }
      />

        <LocationMoveForm products={(products || []) as any} />
    </PageShell>
  )
}
