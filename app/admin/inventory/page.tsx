import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import InventoryTable from '@/components/InventoryTable'

export const dynamic = 'force-dynamic'

export default async function AdminInventoryPage() {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      sku,
      brand,
      source_sheet,
      product_name_cn,
      display_name,
      product_name_en,
      inventory (
        shelf_location,
        quantity_on_hand,
        loose_quantity,
        box_quantity,
        low_stock_threshold,
        updated_at
      )
    `)
    .order('brand', { ascending: true })
    .order('sku', { ascending: true })

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <h1 className="mb-4 text-2xl font-bold">库存列表</h1>
        <p className="text-red-600 dark:text-red-400">
          读取库存失败：{error.message}
        </p>
      </main>
    )
  }

  const totalProducts = products?.length || 0

  const totalStock =
    products?.reduce((sum: number, item: any) => {
      const inv = Array.isArray(item.inventory)
        ? item.inventory[0]
        : item.inventory

      return sum + Number(inv?.quantity_on_hand || 0)
    }, 0) || 0

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">库存列表</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            共 {totalProducts} 个商品，总库存 {totalStock}
          </p>
        </div>

        <div className="flex gap-4">
          <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
            首页
          </Link>

	<Link href="/admin/location-move" className="text-blue-600 hover:underline dark:text-blue-400">
  库位挪动
</Link>

          <Link href="/admin/products/new" className="text-blue-600 hover:underline dark:text-blue-400">
            添加新品
          </Link>

          <Link href="/admin/inbound" className="text-blue-600 hover:underline dark:text-blue-400">
            入库
          </Link>

          <Link href="/admin/correction" className="text-blue-600 hover:underline dark:text-blue-400">
            库存修正
          </Link>

          <Link href="/admin/logs" className="text-blue-600 hover:underline dark:text-blue-400">
            库存流水
          </Link>
        </div>
      </div>

      <InventoryTable products={(products || []) as any} />
    </main>
  )
}