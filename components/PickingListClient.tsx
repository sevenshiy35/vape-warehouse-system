'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import CompletePickingButton from '@/components/CompletePickingButton'

const ORDER_SELECTOR_ID = 'order-selector'
const PICKING_COMPLETE_SCROLL_KEY = 'scrollToPickingOrderSelector'
const PICKING_SELECTOR_HREF = `/admin/picking#${ORDER_SELECTOR_ID}`

type OrderItem = {
  id: string
  sku_snapshot: string | null
  brand_snapshot: string | null
  product_name_cn_snapshot: string | null
  product_name_en_snapshot: string | null
  display_name_snapshot: string | null
  pick_qty: number | null
  shelf_location_snapshot: string | null
}

export type PickingOrder = {
  id: string
  order_no: string
  address: string | null
  note: string | null
  status: string
  created_at: string | null
  order_items: OrderItem[]
}

type Props = {
  orders: PickingOrder[]
  selectedOrderId: string
}

function sortLocation(a: string, b: string) {
  const aEmpty = !a
  const bEmpty = !b

  if (aEmpty && !bEmpty) return 1
  if (!aEmpty && bEmpty) return -1
  if (aEmpty && bEmpty) return 0

  return a.localeCompare(b, 'zh-Hans', {
    numeric: true,
    sensitivity: 'base',
  })
}

function getPickingHref(orderId: string) {
  return `/admin/picking?orderId=${encodeURIComponent(
    orderId
  )}#${ORDER_SELECTOR_ID}`
}

export default function PickingListClient({
  orders,
  selectedOrderId,
}: Props) {
  useEffect(() => {
    const shouldScrollToSelector =
      window.location.hash === `#${ORDER_SELECTOR_ID}` ||
      window.sessionStorage.getItem(PICKING_COMPLETE_SCROLL_KEY) === '1'

    if (!shouldScrollToSelector) return

    window.sessionStorage.removeItem(PICKING_COMPLETE_SCROLL_KEY)
    window.requestAnimationFrame(() => {
      document.getElementById(ORDER_SELECTOR_ID)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [orders.length, selectedOrderId])

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) || orders[0] || null

  const map = new Map<
    string,
    {
      shelf_location: string
      sku: string
      brand: string | null
      product_name_cn: string | null
      product_name_en: string | null
      display_name: string | null
      total_qty: number
    }
  >()

  if (selectedOrder) {
    for (const item of selectedOrder.order_items || []) {
      const location = item.shelf_location_snapshot || ''
      const sku = item.sku_snapshot || ''
      const key = `${location}__${sku}`

      if (!map.has(key)) {
        map.set(key, {
  shelf_location: location,
  sku,
  brand: item.brand_snapshot,
  product_name_cn: item.product_name_cn_snapshot,
  product_name_en: item.product_name_en_snapshot,
  display_name: item.display_name_snapshot,
  total_qty: 0,
})
      }

      const row = map.get(key)
      if (row) {
        row.total_qty += Number(item.pick_qty || 0)
      }
    }
  }

  const pickingRows = Array.from(map.values()).sort((a, b) => {
    const locationResult = sortLocation(
      a.shelf_location || '',
      b.shelf_location || ''
    )

    if (locationResult !== 0) return locationResult

    return String(a.sku || '').localeCompare(String(b.sku || ''), 'zh-Hans', {
      numeric: true,
      sensitivity: 'base',
    })
  })

  const totalPickQty = pickingRows.reduce(
    (sum, row) => sum + Number(row.total_qty || 0),
    0
  )

  if (orders.length === 0) {
    return (
      <div
        id={ORDER_SELECTOR_ID}
        className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <p className="text-gray-500 dark:text-gray-400">
          暂无拣货中订单。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <section
        id={ORDER_SELECTOR_ID}
        className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-5"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
              选择拣货订单
            </label>

            <select
              value={selectedOrder?.id || ''}
              onChange={(e) => {
                window.location.href = getPickingHref(e.currentTarget.value)
              }}
              className="hidden h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 md:block"
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.order_no}
                  {order.address ? ` - ${order.address}` : ''}
                </option>
              ))}
            </select>

            <div className="space-y-2 md:hidden">
              {orders.map((order) => {
                const isActive = selectedOrder?.id === order.id

                const qty = (order.order_items || []).reduce(
                  (sum, item) => sum + Number(item.pick_qty || 0),
                  0
                )

                return (
                  <Link
                    key={order.id}
                    href={getPickingHref(order.id)}
                    className={`block w-full rounded-lg border p-3 text-left transition active:scale-[0.99] ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40'
                        : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold">{order.order_no}</p>
                        <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                          {order.address || '-'}
                        </p>
                      </div>

                      <div className="shrink-0 rounded bg-blue-100 px-3 py-1 text-lg font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {qty}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              当前订单
            </p>
            <p className="mt-1 text-xl font-bold">
              {selectedOrder?.order_no || '-'}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              本单总数量
            </p>
            <p className="mt-1 text-3xl font-bold text-blue-700 dark:text-blue-400 md:text-2xl">
              {totalPickQty}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">本单拣货列表</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              顺序：库位 → 数量 → 品名，方便拣货人员快速核对。
            </p>
          </div>

          <div className="hidden md:block">
            {selectedOrder && (
              <CompletePickingButton
                orderId={selectedOrder.id}
                status={selectedOrder.status}
                completeHref={PICKING_SELECTOR_HREF}
                scrollToPickingSelector
              />
            )}
          </div>
        </div>

        {pickingRows.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            这个订单没有商品。
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 md:block">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="w-[110px] whitespace-nowrap border-b border-gray-200 py-3 pl-3 pr-1 text-left dark:border-gray-700">
                      库位
                    </th>

                    <th className="w-[80px] whitespace-nowrap border-b border-gray-200 px-1 py-3 text-left dark:border-gray-700">
                      总数量
                    </th>

                    <th className="border-b border-gray-200 px-3 py-3 text-left dark:border-gray-700">
                      品名
                    </th>

                    <th className="w-[110px] whitespace-nowrap border-b border-gray-200 px-3 py-3 text-left dark:border-gray-700">
                      品牌
                    </th>

                    <th className="w-[120px] whitespace-nowrap border-b border-gray-200 px-3 py-3 text-left dark:border-gray-700">
                      SKU
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pickingRows.map((row) => (
                    <tr
                      key={`${row.shelf_location}-${row.sku}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                    >
                      <td className="whitespace-nowrap border-b border-gray-200 py-3 pl-3 pr-1 text-xl font-bold dark:border-gray-800">
                        {row.shelf_location || '需要确认'}
                      </td>

                      <td className="whitespace-nowrap border-b border-gray-200 px-1 py-3 text-3xl font-extrabold text-blue-700 dark:border-gray-800 dark:text-blue-400">
                        {row.total_qty}
                      </td>

                      <td className="border-b border-gray-200 px-3 py-3 dark:border-gray-800">
                        <div className="text-base font-semibold">
                          {row.product_name_cn || '-'}
                        </div>

                        {row.product_name_en && (
                          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {row.product_name_en}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 dark:border-gray-800">
                        {row.brand || '-'}
                      </td>

                      <td className="whitespace-nowrap border-b border-gray-200 px-3 py-3 font-medium dark:border-gray-800">
                        {row.sku || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
  {pickingRows.map((row) => (
    <div
      key={`${row.shelf_location}-${row.sku}`}
      className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border-2 border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            库位
          </p>
          <p className="mt-2 text-4xl font-black leading-none text-gray-950 dark:text-gray-50">
            {row.shelf_location || '需要确认'}
          </p>
        </div>

        <div className="rounded-lg border-2 border-blue-400 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/40">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-300">
            数量
          </p>
          <p className="mt-2 text-4xl font-black leading-none text-gray-950 dark:text-gray-50">
            {row.total_qty}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          品名
        </p>

        <p className="mt-1 text-xl font-black text-gray-900 dark:text-gray-100">
          {row.product_name_en || row.product_name_cn || row.display_name || '-'}
        </p>

        {row.display_name && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {row.display_name}
          </p>
        )}

        {!row.display_name && row.product_name_cn && row.product_name_en && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {row.product_name_cn}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          {row.brand || '-'}
        </span>

        <span className="font-medium text-gray-700 dark:text-gray-200">
          {row.sku || '-'}
        </span>
      </div>
    </div>
  ))}
</div>
          </>
        )}

        {selectedOrder && (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
            <h3 className="mb-3 text-base font-semibold">本单配送信息</h3>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">OrderID</p>
                <Link
                  href={`/admin/orders/${selectedOrder.id}`}
                  className="font-medium text-orange-600 hover:underline dark:text-orange-300"
                >
                  {selectedOrder.order_no}
                </Link>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">本单总数量</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {totalPickQty}
                </p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">地址</p>
                <p className="text-lg font-semibold">
                  {selectedOrder.address || '-'}
                </p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">备注</p>
                <p>{selectedOrder.note || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-5">
        <h2 className="mb-4 text-lg font-semibold">所有拣货中订单</h2>

        <div className="space-y-3">
          {orders.map((order) => {
            const qty = (order.order_items || []).reduce(
              (sum, item) => sum + Number(item.pick_qty || 0),
              0
            )

            const isActive = selectedOrder?.id === order.id

            return (
              <Link
                key={order.id}
                href={getPickingHref(order.id)}
                className={`block w-full rounded-lg border p-4 text-left transition active:scale-[0.99] ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-lg font-bold">{order.order_no}</p>
                  <p className="rounded bg-blue-100 px-2 py-1 text-sm font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {qty}
                  </p>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {order.address || '-'}
                </p>

                {order.note && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    备注：{order.note}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      {selectedOrder && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-950 md:hidden">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold">{selectedOrder.order_no}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                本单数量：{totalPickQty}
              </p>
            </div>

            <CompletePickingButton
              orderId={selectedOrder.id}
              status={selectedOrder.status}
              completeHref={PICKING_SELECTOR_HREF}
              scrollToPickingSelector
            />
          </div>
        </div>
      )}
    </div>
  )
}
