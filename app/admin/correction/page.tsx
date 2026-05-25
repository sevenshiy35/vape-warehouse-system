import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import CorrectionForm from '@/components/CorrectionForm'

export const dynamic = 'force-dynamic'

export default async function AdminCorrectionPage() {
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
      <main className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <h1 className="mb-4 text-2xl font-bold">库存修正</h1>
        <p className="text-red-600 dark:text-red-400">
          读取商品失败：{error.message}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">库存修正</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              用于盘点时把系统库存修正为实际库存。
            </p>
          </div>

          <div className="flex gap-4">
            <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
              首页
            </Link>

            <Link href="/admin/inventory" className="text-blue-600 hover:underline dark:text-blue-400">
              库存列表
            </Link>

            <Link href="/admin/logs" className="text-blue-600 hover:underline dark:text-blue-400">
              库存流水
            </Link>
          </div>
        </div>

        <CorrectionForm products={(products || []) as any} />
      </div>
    </main>
  )
}