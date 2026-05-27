import NewProductForm from '@/components/NewProductForm'
import { NavButton, PageHeader, PageShell } from '@/components/PageChrome'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function normalizeBrandOptions(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value || '').trim()).filter(Boolean))
  ).sort((a, b) =>
    a.localeCompare(b, 'zh-Hans', {
      numeric: true,
      sensitivity: 'base',
    })
  )
}

async function getBrandOptions() {
  const [productBrands, configuredBrands] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('brand')
      .not('brand', 'is', null)
      .order('brand', { ascending: true }),
    supabaseAdmin
      .from('product_brands')
      .select('brand_name')
      .eq('is_active', true)
      .order('brand_name', { ascending: true }),
  ])

  return normalizeBrandOptions([
    ...((productBrands.data || []).map((item) => item.brand)),
    ...((configuredBrands.data || []).map((item) => item.brand_name)),
  ])
}

export default async function NewProductPage() {
  const brandOptions = await getBrandOptions()

  return (
    <PageShell maxWidth="max-w-5xl">
      <PageHeader
        title="添加新品库存"
        description="创建新的 SKU，并设置初始库存和库位。"
        actions={
          <>
            <NavButton href="/admin/inventory">库存列表</NavButton>
            <NavButton href="/admin/inbound" variant="primary">
              入库
            </NavButton>
          </>
        }
      />

        <NewProductForm brandOptions={brandOptions} />
    </PageShell>
  )
}
