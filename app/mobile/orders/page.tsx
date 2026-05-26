import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    error?: string
    success?: string
  }>
}

function getStatusLabel(status: string) {
  if (status === 'uploaded') return '已上传'
  if (status === 'need_review') return '待确认'
  if (status === 'picking') return '拣货中'
  if (status === 'picking_editing') return '拣货修改中'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return status
}

function getStatusClass(status: string) {
  if (status === 'completed') return 'bg-green-100 text-green-800'
  if (status === 'cancelled') return 'bg-red-100 text-red-800'
  if (status === 'picking') return 'bg-orange-100 text-orange-800'
  if (status === 'picking_editing') return 'bg-purple-100 text-purple-800'
  if (status === 'need_review') return 'bg-yellow-100 text-yellow-800'
  return 'bg-blue-100 text-blue-800'
}

export default async function MobileOrdersPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {}

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_no, address, note, status, total_items, created_at')
    .order('created_at', { ascending: false })
    .limit(80)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-5 text-gray-950">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">
            Mobile
          </p>
          <h1 className="text-2xl font-bold">手机端订单</h1>
          <div className="flex gap-2">
            <Link
              href="/submit-order"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              提交订单
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
            >
              首页
            </Link>
          </div>
        </header>

        {sp.success && (
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {sp.success}
          </p>
        )}

        {sp.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {sp.error}
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            读取订单失败：{error.message}
          </p>
        )}

        <div className="space-y-3">
          {(orders || []).map((order) => (
            <Link
              key={order.id}
              href={`/mobile/orders/${order.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-bold text-blue-700">
                    {order.order_no}
                  </p>
                  <p className="mt-1 truncate text-sm text-gray-600">
                    {order.address || '-'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${getStatusClass(
                    order.status
                  )}`}
                >
                  {getStatusLabel(order.status)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm text-gray-500">
                <span>商品：{order.total_items ?? '-'}</span>
                <span>
                  {order.created_at
                    ? new Date(order.created_at).toLocaleString()
                    : '-'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
