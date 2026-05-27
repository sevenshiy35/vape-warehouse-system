import Link from 'next/link'
import { formatEasternTime } from '@/lib/time'

type Order = {
  id: string
  order_no: string
  address: string | null
  note: string | null
  status: string
  image_path: string | null
  image_paths?: string[] | null
  total_items: number | null
  created_at: string | null
}

type Filters = {
  q: string
  status: string
  dateFrom: string
  dateTo: string
  sort: string
  dir: string
}

type Props = {
  orders: Order[]
  filters: Filters
}

const statusOptions = [
  { value: '全部', label: '全部' },
  { value: 'uploaded', label: '已上传' },
  { value: 'need_review', label: '待确认' },
  { value: 'picking', label: '拣货中' },
  { value: 'picking_editing', label: '拣货修改中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

function buildOrdersHref(next: Partial<Filters>) {
  const params = new URLSearchParams()

  const merged: Filters = {
    q: '',
    status: '全部',
    dateFrom: '',
    dateTo: '',
    sort: 'created_at',
    dir: 'desc',
    ...next,
  }

  if (merged.q) params.set('q', merged.q)
  if (merged.status && merged.status !== '全部') {
    params.set('status', merged.status)
  }
  if (merged.dateFrom) params.set('dateFrom', merged.dateFrom)
  if (merged.dateTo) params.set('dateTo', merged.dateTo)
  if (merged.sort && merged.sort !== 'created_at') {
    params.set('sort', merged.sort)
  }
  if (merged.dir && merged.dir !== 'desc') {
    params.set('dir', merged.dir)
  }

  const query = params.toString()
  return query ? `/admin/orders?${query}` : '/admin/orders'
}

function getStatusClass(status: string) {
  if (status === 'uploaded') {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  }

  if (status === 'need_review') {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
  }

  if (status === 'picking') {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
  }

  if (status === 'picking_editing') {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
  }

  if (status === 'completed') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  }

  if (status === 'cancelled') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  }

  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
}

function getStatusLabel(status: string) {
  return statusOptions.find((item) => item.value === status)?.label || status
}

function getImageCount(order: Order) {
  if (Array.isArray(order.image_paths) && order.image_paths.length > 0) {
    return order.image_paths.length
  }

  return order.image_path ? 1 : 0
}

function SortHeader({
  label,
  sortKey,
  filters,
}: {
  label: string
  sortKey: string
  filters: Filters
}) {
  const active = filters.sort === sortKey
  const nextDir = active && filters.dir === 'asc' ? 'desc' : 'asc'

  return (
    <Link
      href={buildOrdersHref({
        ...filters,
        sort: sortKey,
        dir: nextDir,
      })}
      className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400"
    >
      {label}
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {active ? (filters.dir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </Link>
  )
}

export default function OrdersTable({ orders, filters }: Props) {
  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 md:text-sm'

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <form method="get" action="/admin/orders" className="space-y-4">
          <input type="hidden" name="sort" value={filters.sort} />
          <input type="hidden" name="dir" value={filters.dir} />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                搜索订单
              </label>
              <input
                name="q"
                className={inputClass}
                defaultValue={filters.q}
                placeholder="OrderID / 地址 / 备注"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                状态
              </label>
              <select
                name="status"
                className={inputClass}
                defaultValue={filters.status || '全部'}
              >
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                开始日期
              </label>
              <input
                name="dateFrom"
                type="date"
                className={inputClass}
                defaultValue={filters.dateFrom}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                结束日期
              </label>
              <input
                name="dateTo"
                type="date"
                className={inputClass}
                defaultValue={filters.dateTo}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((item) => {
                const active =
                  (filters.status || '全部') === item.value ||
                  (!filters.status && item.value === '全部')

                return (
                  <Link
                    key={item.value}
                    href={buildOrdersHref({
                      ...filters,
                      status: item.value,
                    })}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      active
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 md:flex-none"
              >
                应用筛选
              </button>

              <Link
                href="/admin/orders"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 md:flex-none"
              >
                清空筛选
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          当前结果：{orders.length} 个订单
        </div>
      </section>

      {/* 手机端卡片 */}
      <div className="space-y-3 md:hidden">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            没有符合条件的订单
          </div>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {order.order_no}
                  </p>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatEasternTime(order.created_at)}
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

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    地址
                  </p>
                  <p className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">
                    {order.address || '-'}
                  </p>
                </div>

                {order.note && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      备注
                    </p>
                    <p className="mt-0.5 text-gray-700 dark:text-gray-300">
                      {order.note}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-3 dark:border-gray-800">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      商品数
                    </p>
                    <p className="text-lg font-bold">
                      {order.total_items ?? '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      截图
                    </p>
                    <p className="text-lg font-bold">{getImageCount(order)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-center text-sm font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                查看订单详情
              </div>
            </Link>
          ))
        )}
      </div>

      {/* 电脑端表格 */}
      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 md:block">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="OrderID" sortKey="order_no" filters={filters} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="地址" sortKey="address" filters={filters} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="备注" sortKey="note" filters={filters} />
              </th>

              <th className="w-28 whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="状态" sortKey="status" filters={filters} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="商品数" sortKey="total_items" filters={filters} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                截图
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="创建时间" sortKey="created_at" filters={filters} />
              </th>
            </tr>
          </thead>

          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-gray-500 dark:text-gray-400"
                >
                  没有符合条件的订单
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                >
                  <td className="border-b border-gray-200 p-3 font-medium dark:border-gray-800">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {order.order_no}
                    </Link>
                  </td>

                  <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                    {order.address || '-'}
                  </td>

                  <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                    {order.note || '-'}
                  </td>

                  <td className="w-28 whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                    <span
                      className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${getStatusClass(
                      order.status
                    )}`}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                  </td>

                  <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                    {order.total_items ?? '-'}
                  </td>

                  <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                    {getImageCount(order)}
                  </td>

                  <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                    {formatEasternTime(order.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
