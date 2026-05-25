import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminLogsPage() {
  const { data: logs, error } = await supabaseAdmin
    .from('inventory_logs')
    .select(`
      id,
      sku_snapshot,
      product_name_snapshot,
      change_qty,
      before_qty,
      after_qty,
      log_type,
      reason,
      operator,
      created_at,
      old_shelf_location,
      new_shelf_location,
      orders (
        order_no
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <h1 className="mb-4 text-2xl font-bold">库存流水</h1>
        <p className="text-red-600 dark:text-red-400">
          读取库存流水失败：{error.message}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">库存流水</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            查看所有出库、入库、盘点修正、库位挪动记录
          </p>
        </div>

        <div className="flex gap-4">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            首页
          </Link>

          <Link
            href="/admin/orders"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            订单列表
          </Link>

          <Link
            href="/admin/inventory"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            库存列表
          </Link>

          <Link
            href="/admin/inbound"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            入库
          </Link>

          <Link
            href="/admin/correction"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            库存修正
          </Link>

          <Link
            href="/admin/location-move"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            库位挪动
          </Link>
        </div>
      </div>

      {!logs || logs.length === 0 ? (
        <div className="rounded border border-gray-200 bg-white p-6 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          暂无库存流水
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  时间
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  类型
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  OrderID
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  SKU
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  商品名
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  变化
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  库存前
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  库存后
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  库位变化
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  原因
                </th>
                <th className="border-b border-gray-200 p-3 text-left text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  操作人
                </th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log: any) => {
                const change = Number(log.change_qty || 0)

                const changeClass =
                  change < 0
                    ? 'text-red-600 font-medium dark:text-red-400'
                    : change > 0
                    ? 'text-green-700 font-medium dark:text-green-400'
                    : 'text-gray-700 dark:text-gray-300'

                let typeClass =
                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'

                if (log.log_type === 'Order') {
                  typeClass =
                    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                } else if (log.log_type === 'Inbound') {
                  typeClass =
                    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                } else if (log.log_type === 'Correction') {
                  typeClass =
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                } else if (log.log_type === 'OrderReversal') {
                  typeClass =
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                } else if (log.log_type === 'LocationMove') {
                  typeClass =
                    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                }

                const orderInfo = Array.isArray(log.orders)
                  ? log.orders[0]
                  : log.orders

                const locationChange =
                  log.old_shelf_location || log.new_shelf_location
                    ? `${log.old_shelf_location || '-'} → ${
                        log.new_shelf_location || '-'
                      }`
                    : '-'

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  >
                    <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      <span className={`rounded px-2 py-1 ${typeClass}`}>
                        {log.log_type}
                      </span>
                    </td>

                    <td className="border-b border-gray-200 p-3 font-medium dark:border-gray-800">
                      {orderInfo?.order_no || '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 font-medium dark:border-gray-800">
                      {log.sku_snapshot || '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {log.product_name_snapshot || '-'}
                    </td>

                    <td
                      className={`border-b border-gray-200 p-3 dark:border-gray-800 ${changeClass}`}
                    >
                      {change > 0 ? `+${change}` : change}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {log.before_qty}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {log.after_qty}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {locationChange}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {log.reason || '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {log.operator || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}