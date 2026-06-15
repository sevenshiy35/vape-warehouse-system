'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatEasternTime } from '@/lib/time'

export type InventoryLogRow = {
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

type LogCategory = {
  key: string
  label: string
  description: string
  type: string | null
  badgeClass: string
}

const logCategories: LogCategory[] = [
  {
    key: 'all',
    label: '全部',
    description: '所有库存变化',
    type: null,
    badgeClass:
      'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  {
    key: 'order',
    label: '订单出库',
    description: '确认订单时预扣库存',
    type: 'Order',
    badgeClass:
      'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
  {
    key: 'inbound',
    label: '入库',
    description: '到货补充库存',
    type: 'Inbound',
    badgeClass:
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  {
    key: 'correction',
    label: '盘点修正',
    description: '盘点后调整数量',
    type: 'Correction',
    badgeClass:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  {
    key: 'reversal',
    label: '订单退回',
    description: '取消订单后退回预扣',
    type: 'OrderReversal',
    badgeClass:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    key: 'location',
    label: '库位挪动',
    description: '只调整货架位置',
    type: 'LocationMove',
    badgeClass:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  },
]

const desktopColumns = [
  { label: '时间', className: 'w-[170px]' },
  { label: '分类', className: 'w-[110px]' },
  { label: 'OrderID', className: 'w-[120px]' },
  { label: 'SKU', className: 'w-[110px]' },
  { label: '商品名', className: 'w-[220px]' },
  { label: '变化', className: 'w-[80px]' },
  { label: '库存前', className: 'w-[90px]' },
  { label: '库存后', className: 'w-[90px]' },
  { label: '库位变化', className: 'w-[150px]' },
  { label: '原因', className: 'w-[260px]' },
  { label: '操作人', className: 'w-[100px]' },
]

const PAGE_SIZE = 50

type Props = {
  logs: InventoryLogRow[]
}

function getOrderNo(log: InventoryLogRow) {
  const orderInfo = Array.isArray(log.orders) ? log.orders[0] : log.orders
  return orderInfo?.order_no || ''
}

function getLocationChange(log: InventoryLogRow) {
  if (!log.old_shelf_location && !log.new_shelf_location) return '-'

  return `${log.old_shelf_location || '-'} → ${log.new_shelf_location || '-'}`
}

function getCategory(logType: string | null | undefined) {
  return (
    logCategories.find((category) => category.type === logType) ||
    logCategories[0]
  )
}

function formatChange(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

export default function InventoryLogsTable({ logs }: Props) {
  const [categoryKey, setCategoryKey] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const selectedCategory =
    logCategories.find((category) => category.key === categoryKey) ||
    logCategories[0]

  const categoryStats = useMemo(() => {
    return logCategories.map((category) => {
      const categoryLogs =
        category.key === 'all'
          ? logs
          : logs.filter((log) => log.log_type === category.type)

      const netChange = categoryLogs.reduce(
        (sum, log) => sum + Number(log.change_qty || 0),
        0
      )

      return {
        ...category,
        count: categoryLogs.length,
        netChange,
      }
    })
  }, [logs])

  const filteredLogs = useMemo(() => {
    const keywords = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)

    return logs.filter((log) => {
      if (
        selectedCategory.key !== 'all' &&
        log.log_type !== selectedCategory.type
      ) {
        return false
      }

      if (keywords.length === 0) return true

      const searchableText = [
        log.sku_snapshot,
        log.product_name_snapshot,
        log.reason,
        log.operator,
        log.log_type,
        getOrderNo(log),
        log.old_shelf_location,
        log.new_shelf_location,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return keywords.every((keyword) => searchableText.includes(keyword))
    })
  }, [logs, search, selectedCategory])

  const filteredNetChange = filteredLogs.reduce(
    (sum, log) => sum + Number(log.change_qty || 0),
    0
  )

  const hasActiveFilters = categoryKey !== 'all' || search.trim()
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const normalizedPage = Math.min(page, totalPages)
  const pageStartIndex = (normalizedPage - 1) * PAGE_SIZE
  const pageLogs = filteredLogs.slice(pageStartIndex, pageStartIndex + PAGE_SIZE)
  const visibleStart = filteredLogs.length === 0 ? 0 : pageStartIndex + 1
  const visibleEnd = Math.min(pageStartIndex + PAGE_SIZE, filteredLogs.length)
  const canGoPrevious = normalizedPage > 1
  const canGoNext = normalizedPage < totalPages

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  function resetPage() {
    setPage(1)
  }

  function renderPaginationControls() {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-gray-600 dark:text-gray-400">
          每页 {PAGE_SIZE} 条，当前显示 {visibleStart}-{visibleEnd} / 共{' '}
          {filteredLogs.length} 条
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800 dark:disabled:border-gray-800 dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
          >
            上一页
          </button>

          <span className="px-2 text-gray-600 dark:text-gray-400">
            第 {normalizedPage} / {totalPages} 页
          </span>

          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800 dark:disabled:border-gray-800 dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
          >
            下一页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {categoryStats.map((category) => {
          const active = category.key === categoryKey

          return (
            <button
              key={category.key}
              type="button"
              onClick={() => {
                setCategoryKey(category.key)
                resetPage()
              }}
              className={`rounded-lg border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                active
                  ? 'border-gray-900 bg-gray-950 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950'
                  : 'border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{category.label}</p>
                  <p
                    className={`mt-1 text-xs ${
                      active
                        ? 'text-gray-300 dark:text-gray-700'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {category.description}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    active
                      ? 'bg-white/15 text-white dark:bg-gray-950/10 dark:text-gray-950'
                      : category.badgeClass
                  }`}
                >
                  {category.count}
                </span>
              </div>

              <p
                className={`mt-3 text-xs ${
                  active
                    ? 'text-gray-300 dark:text-gray-700'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                净变化 {formatChange(category.netChange)}
              </p>
            </button>
          )
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              搜索流水
            </label>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                resetPage()
              }}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
              placeholder="SKU / 商品名 / OrderID / 库位 / 原因"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-950">
            <p className="text-gray-500 dark:text-gray-400">当前记录</p>
            <p className="mt-1 text-lg font-bold">{filteredLogs.length}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-950">
            <p className="text-gray-500 dark:text-gray-400">当前净变化</p>
            <p className="mt-1 text-lg font-bold">
              {formatChange(filteredNetChange)}
            </p>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setCategoryKey('all')
              setSearch('')
              resetPage()
            }}
            className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            清空分类和搜索
          </button>
        )}
      </section>

      {filteredLogs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          当前分类下暂无库存流水。
        </div>
      ) : (
        <>
          {renderPaginationControls()}

          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 md:block">
            <table className="min-w-[1500px] table-fixed text-sm">
              <colgroup>
                {desktopColumns.map((column) => (
                  <col key={column.label} className={column.className} />
                ))}
              </colgroup>
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  {desktopColumns.map((column) => (
                    <th
                      key={column.label}
                      className="whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pageLogs.map((log) => {
                  const change = Number(log.change_qty || 0)
                  const category = getCategory(log.log_type)
                  const changeClass =
                    change < 0
                      ? 'text-red-600 font-medium dark:text-red-400'
                      : change > 0
                      ? 'text-green-700 font-medium dark:text-green-400'
                      : 'text-gray-700 dark:text-gray-300'

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                    >
                      <td className="whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800">
                        {formatEasternTime(log.created_at)}
                      </td>
                      <td className="border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800">
                        <span
                          className={`inline-flex whitespace-nowrap rounded px-2 py-1 ${category.badgeClass}`}
                        >
                          {category.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle font-medium dark:border-gray-800">
                        {getOrderNo(log) || '-'}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle font-medium dark:border-gray-800">
                        {log.sku_snapshot || '-'}
                      </td>
                      <td className="break-words border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800">
                        {log.product_name_snapshot || '-'}
                      </td>
                      <td
                        className={`whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800 ${changeClass}`}
                      >
                        {formatChange(change)}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800">
                        {log.before_qty}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800">
                        {log.after_qty}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800">
                        {getLocationChange(log)}
                      </td>
                      <td className="break-words border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800">
                        {log.reason || '-'}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-200 p-3 text-left align-middle dark:border-gray-800">
                        {log.operator || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {pageLogs.map((log) => {
              const change = Number(log.change_qty || 0)
              const category = getCategory(log.log_type)
              const changeClass =
                change < 0
                  ? 'text-red-600 dark:text-red-400'
                  : change > 0
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-gray-700 dark:text-gray-300'

              return (
                <div
                  key={log.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {log.sku_snapshot || '-'}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {log.product_name_snapshot || '-'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-1 text-xs ${category.badgeClass}`}
                    >
                      {category.label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                      <p className="text-gray-500 dark:text-gray-400">变化</p>
                      <p className={`mt-1 text-lg font-bold ${changeClass}`}>
                        {formatChange(change)}
                      </p>
                    </div>
                    <div className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                      <p className="text-gray-500 dark:text-gray-400">库存</p>
                      <p className="mt-1 font-semibold">
                        {log.before_qty ?? '-'} → {log.after_qty ?? '-'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <p>时间：{formatEasternTime(log.created_at)}</p>
                    <p>OrderID：{getOrderNo(log) || '-'}</p>
                    <p>库位：{getLocationChange(log)}</p>
                    <p>原因：{log.reason || '-'}</p>
                    <p>操作人：{log.operator || '-'}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {renderPaginationControls()}
        </>
      )}
    </div>
  )
}
