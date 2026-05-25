import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import PickingListClient from '@/components/PickingListClient'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    orderId?: string
  }>
}

export default async function PickingPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {}
  const orderIdParam = typeof sp.orderId === 'string' ? sp.orderId : ''

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_no,
      address,
      note,
      status,
      created_at,
      order_items (
        id,
        sku_snapshot,
        brand_snapshot,
        product_name_cn_snapshot,
        product_name_en_snapshot,
        display_name_snapshot,
        pick_qty,
        shelf_location_snapshot
      )
    `)
    .in('status', ['picking', 'picking_editing'])
    .order('created_at', { ascending: true })

  const navButtonClass =
    'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 md:px-5 md:py-2.5 md:text-base'

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8">
        <h1 className="mb-4 text-2xl font-bold">拣货列表</h1>
        <p className="text-red-600 dark:text-red-400">
          读取拣货订单失败：{error.message}
        </p>
      </main>
    )
  }

  const safeOrders = (orders || []) as any[]

  const selectedOrderId = safeOrders.some((order) => order.id === orderIdParam)
    ? orderIdParam
    : safeOrders[0]?.id || ''

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">拣货列表</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 md:text-base">
              按单号选择订单，一单一单拣货和打包。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/" className={navButtonClass}>
              首页
            </Link>

            <Link href="/admin/orders" className={navButtonClass}>
              订单列表
            </Link>

            <Link href="/admin/inventory" className={navButtonClass}>
              库存列表
            </Link>

            <Link href="/admin/logs" className={navButtonClass}>
              库存流水
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              拣货中订单
            </p>
            <p className="mt-1 text-2xl font-bold">{safeOrders.length}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              拣货方式
            </p>
            <p className="mt-1 text-lg font-semibold">按单号拣货</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              排序方式
            </p>
            <p className="mt-1 text-lg font-semibold">按库位顺序</p>
          </div>
        </div>

        <PickingListClient
          orders={safeOrders}
          selectedOrderId={selectedOrderId}
        />
      </div>
    </main>
  )
}