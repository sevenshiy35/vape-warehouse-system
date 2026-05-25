import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import OrdersTable from '@/components/OrdersTable'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    q?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    sort?: string
    dir?: string
  }>
}

const validStatuses = new Set([
  'uploaded',
  'need_review',
  'picking',
  'picking_editing',
  'completed',
  'cancelled',
])

const validSortKeys = new Set([
  'order_no',
  'address',
  'note',
  'status',
  'total_items',
  'created_at',
])

function cleanSearchText(value: string) {
  return value.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {}

  const q = String(sp.q || '').trim()
  const status = String(sp.status || '全部')
  const dateFrom = String(sp.dateFrom || '')
  const dateTo = String(sp.dateTo || '')
  const sort = validSortKeys.has(String(sp.sort))
    ? String(sp.sort)
    : 'created_at'
  const dir = sp.dir === 'asc' ? 'asc' : 'desc'

  let query = supabaseAdmin
    .from('orders')
    .select(
      'id, order_no, address, note, status, image_path, image_paths, total_items, created_at'
    )

  if (status !== '全部' && validStatuses.has(status)) {
    query = query.eq('status', status)
  }

  if (dateFrom) {
    query = query.gte('created_at', `${dateFrom}T00:00:00`)
  }

  if (dateTo) {
    query = query.lte('created_at', `${dateTo}T23:59:59`)
  }

  if (q) {
    const safeQ = cleanSearchText(q)

    if (safeQ) {
      query = query.or(
        `order_no.ilike.%${safeQ}%,address.ilike.%${safeQ}%,note.ilike.%${safeQ}%`
      )
    }
  }

  const { data: orders, error } = await query.order(sort, {
    ascending: dir === 'asc',
  })

  const navButtonClass =
    'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 md:px-5 md:py-2.5 md:text-base'

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8">
        <h1 className="mb-4 text-2xl font-bold">订单列表</h1>
        <p className="text-red-600 dark:text-red-400">
          读取订单失败：{error.message}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">订单列表</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 md:text-base">
              查看所有订单，点 OrderID 可进入订单详情。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/" className={navButtonClass}>
              首页
            </Link>

            <Link href="/submit-order" className={navButtonClass}>
              提交新订单
            </Link>

            <Link href="/admin/picking" className={navButtonClass}>
              拣货列表
            </Link>

            <Link href="/admin/inventory" className={navButtonClass}>
              库存列表
            </Link>

            <Link href="/admin/logs" className={navButtonClass}>
              库存流水
            </Link>
          </div>
        </div>

        <OrdersTable
          orders={(orders || []) as any}
          filters={{
            q,
            status,
            dateFrom,
            dateTo,
            sort,
            dir,
          }}
        />
      </div>
    </main>
  )
}