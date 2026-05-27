import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NavButton, PageHeader, PageShell, Panel } from '@/components/PageChrome'
import { formatEasternTime } from '@/lib/time'

export const dynamic = 'force-dynamic'

type InventoryLog = {
  id: string
  sku_snapshot: string | null
  product_name_snapshot: string | null
  change_qty: number | null
  before_qty: number | null
  after_qty: number | null
  log_type: string | null
  reason: string | null
  operator: string | null
  created_at: string | null
  old_shelf_location: string | null
  new_shelf_location: string | null
  orders: { order_no: string | null } | { order_no: string | null }[] | null
}

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
      <PageShell>
        <PageHeader title="库存流水" />
        <p className="text-red-600 dark:text-red-400">
          读取库存流水失败：{error.message}
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="库存流水"
        description="查看所有出库、入库、盘点修正、库位挪动记录"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/orders">订单列表</NavButton>
            <NavButton href="/admin/inventory" variant="primary">
              库存列表
            </NavButton>
            <NavButton href="/admin/inbound">入库</NavButton>
            <NavButton href="/admin/correction">库存修正</NavButton>
            <NavButton href="/admin/location-move">库位挪动</NavButton>
          </>
        }
      />

      {!logs || logs.length === 0 ? (
        <Panel className="text-gray-500 dark:text-gray-400">
          暂无库存流水
        </Panel>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
              {(logs as InventoryLog[]).map((log) => {
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
                      {formatEasternTime(log.created_at)}
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
    </PageShell>
  )
}
