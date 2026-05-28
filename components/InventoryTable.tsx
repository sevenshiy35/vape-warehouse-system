'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getInventoryRecord,
  type ProductWithInventory,
} from '@/lib/types'

type InventoryProduct = ProductWithInventory

type Props = {
  products: InventoryProduct[]
}

type SortKey =
  | 'brand'
  | 'sku'
  | 'product_name_cn'
  | 'display_name'
  | 'product_name_en'
  | 'shelf_location'
  | 'quantity_on_hand'
  | 'status'

type SortDirection = 'asc' | 'desc'

const statusFilters = ['全部', 'OK', '低库存', '无库存', '缺少库位'] as const

type InventoryStatusFilter = (typeof statusFilters)[number]

type InventoryFilterState = {
  q: string
  brand: string
  status: InventoryStatusFilter
  location: string
}

function normalizeBrand(brand: string | null | undefined) {
  return String(brand || '').trim()
}

function getQueryStatus(value: string | null): InventoryStatusFilter {
  return statusFilters.includes(value as InventoryStatusFilter)
    ? (value as InventoryStatusFilter)
    : '全部'
}

function getStatus(product: InventoryProduct) {
  const inv = getInventoryRecord(product)
  const quantity = Number(inv?.quantity_on_hand || 0)
  const threshold = Number(inv?.low_stock_threshold || 3)
  const shelfLocation = inv?.shelf_location || ''

  if (quantity === 0) return '无库存'
  if (quantity > 0 && !shelfLocation) return '缺少库位'
  if (quantity <= threshold) return '低库存'
  return 'OK'
}

function getSortValue(product: InventoryProduct, key: SortKey) {
  const inv = getInventoryRecord(product)

  if (key === 'shelf_location') {
    return inv?.shelf_location || null
  }

  if (key === 'quantity_on_hand') {
    return inv?.quantity_on_hand === null || inv?.quantity_on_hand === undefined
      ? null
      : Number(inv.quantity_on_hand)
  }

  if (key === 'status') {
    return getStatus(product)
  }

  const value = product[key]

  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  return String(value)
}

function SortHeader({
  label,
  sortKey,
  currentSortKey,
  direction,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentSortKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
}) {
  const active = currentSortKey === sortKey

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400"
    >
      {label}
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  )
}

export default function InventoryTable({ products }: Props) {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [brandFilter, setBrandFilter] = useState(
    () => searchParams.get('brand') || '全部'
  )
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>(() =>
    getQueryStatus(searchParams.get('status'))
  )
  const [locationSearch, setLocationSearch] = useState(
    () => searchParams.get('location') || ''
  )

  const [sortKey, setSortKey] = useState<SortKey>('brand')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const brands = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((p) => normalizeBrand(p.brand)).filter(Boolean))
    )

    return [
      '全部',
      ...unique.sort((a, b) =>
        a.localeCompare(b, 'zh-Hans', {
          numeric: true,
          sensitivity: 'base',
        })
      ),
    ]
  }, [products])

  function syncFilterUrl(nextFilters: InventoryFilterState) {
    const params = new URLSearchParams(window.location.search)

    const values = {
      q: nextFilters.q.trim(),
      brand: nextFilters.brand.trim(),
      status: nextFilters.status,
      location: nextFilters.location.trim(),
    }

    if (values.q) {
      params.set('q', values.q)
    } else {
      params.delete('q')
    }

    if (values.brand && values.brand !== '全部') {
      params.set('brand', values.brand)
    } else {
      params.delete('brand')
    }

    if (values.status !== '全部') {
      params.set('status', values.status)
    } else {
      params.delete('status')
    }

    if (values.location) {
      params.set('location', values.location)
    } else {
      params.delete('location')
    }

    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      query ? `/admin/inventory?${query}` : '/admin/inventory'
    )
  }

  function applyFilters(nextFilters: InventoryFilterState) {
    const cleanFilters = {
      q: nextFilters.q.trim(),
      brand: nextFilters.brand.trim() || '全部',
      status: nextFilters.status,
      location: nextFilters.location.trim(),
    }

    setSearch(cleanFilters.q)
    setBrandFilter(cleanFilters.brand)
    setStatusFilter(cleanFilters.status)
    setLocationSearch(cleanFilters.location)
    setSortKey('brand')
    setSortDirection('asc')
    syncFilterUrl(cleanFilters)
  }

  function updateFilters(nextFilters: Partial<InventoryFilterState>) {
    applyFilters({
      q: search,
      brand: brandFilter,
      status: statusFilter,
      location: locationSearch,
      ...nextFilters,
    })
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const inv = getInventoryRecord(product)
      const status = getStatus(product)

      const keywords = search
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
      const locationKeyword = locationSearch.trim().toLowerCase()

      const searchableText = [
        product.sku,
        product.brand,
        product.product_name_cn,
        product.product_name_en,
        product.display_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const shelfLocation = String(inv?.shelf_location || '').toLowerCase()

      if (
        keywords.length > 0 &&
        !keywords.every((keyword) => searchableText.includes(keyword))
      ) {
        return false
      }

      if (
        brandFilter !== '全部' &&
        normalizeBrand(product.brand) !== brandFilter
      ) {
        return false
      }

      if (statusFilter !== '全部' && status !== statusFilter) {
        return false
      }

      if (locationKeyword && !shelfLocation.includes(locationKeyword)) {
        return false
      }

      return true
    })
  }, [products, search, brandFilter, statusFilter, locationSearch])

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aValue = getSortValue(a, sortKey)
      const bValue = getSortValue(b, sortKey)

      const aIsEmpty = aValue === null || aValue === undefined || aValue === ''
      const bIsEmpty = bValue === null || bValue === undefined || bValue === ''

      if (aIsEmpty && !bIsEmpty) return 1
      if (!aIsEmpty && bIsEmpty) return -1
      if (aIsEmpty && bIsEmpty) return 0

      let result = 0

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        result = aValue - bValue
      } else {
        result = String(aValue).localeCompare(String(bValue), 'zh-Hans', {
          numeric: true,
          sensitivity: 'base',
        })
      }

      return sortDirection === 'asc' ? result : -result
    })
  }, [filteredProducts, sortKey, sortDirection])

  const totalStock = sortedProducts.reduce((sum, product) => {
    const inv = getInventoryRecord(product)
    return sum + Number(inv?.quantity_on_hand || 0)
  }, 0)

  const hasActiveFilters =
    search.trim() ||
    brandFilter !== '全部' ||
    statusFilter !== '全部' ||
    locationSearch.trim()

  function resetFilters() {
    const nextFilters: InventoryFilterState = {
      q: '',
      brand: '全部',
      status: '全部',
      location: '',
    }

    applyFilters(nextFilters)
  }

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => event.preventDefault()}
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              搜索商品
            </label>
            <input
              name="q"
              className={inputClass}
              value={search}
              onChange={(event) => updateFilters({ q: event.target.value })}
              placeholder="SKU / 中文 / 英文 / 展示名"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              品牌
            </label>
            <select
              name="brand"
              className={inputClass}
              value={brandFilter}
              onChange={(event) => updateFilters({ brand: event.target.value })}
            >
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              库位
            </label>
            <input
              name="location"
              className={inputClass}
              value={locationSearch}
              onChange={(event) =>
                updateFilters({ location: event.target.value })
              }
              placeholder="例如 A1 / B2 / SP区"
            />
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            库存状态
          </legend>

          <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => {
            const active = statusFilter === status

            return (
              <label
                key={status}
                className="cursor-pointer select-none active:scale-[0.98]"
              >
                <input
                  type="radio"
                  name="status"
                  value={status}
                  checked={status === statusFilter}
                  onChange={() => updateFilters({ status })}
                  className="peer sr-only"
                />
                <span
                  className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                  } peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 dark:peer-checked:border-blue-700 dark:peer-checked:bg-blue-950/40 dark:peer-checked:text-blue-300`}
                >
                  {status}
                </span>
              </label>
            )
          })}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            当前显示 {sortedProducts.length} 个商品，总库存 {totalStock}
            {hasActiveFilters ? '，已应用筛选' : ''}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              清空筛选
            </button>
          </div>
        </div>
      </form>

      <div className="space-y-3 md:hidden">
        {sortedProducts.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            没有符合条件的库存
          </div>
        ) : (
          sortedProducts.map((product) => {
            const inv = getInventoryRecord(product)
            const quantity = Number(inv?.quantity_on_hand || 0)
            const status = getStatus(product)
            const shelfLocation = inv?.shelf_location || ''

            let statusClass =
              'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'

            if (status === '无库存') {
              statusClass =
                'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
            } else if (status === '低库存') {
              statusClass =
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
            } else if (status === '缺少库位') {
              statusClass =
                'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
            }

            return (
              <div
                key={product.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {product.brand || '-'}
                      </span>
                      <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {product.sku}
                      </span>
                    </div>

                    <p className="mt-2 text-base font-semibold text-gray-950 dark:text-gray-50">
                      {product.display_name ||
                        product.product_name_cn ||
                        product.product_name_en ||
                        '-'}
                    </p>

                    {product.product_name_en && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {product.product_name_en}
                      </p>
                    )}
                  </div>

                  <span
                    className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${statusClass}`}
                  >
                    {status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      库位
                    </p>
                    <p className="mt-1 truncate font-bold">
                      {shelfLocation || '-'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      库存
                    </p>
                    <p className="mt-1 text-lg font-bold">{quantity}</p>
                  </div>

                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="品牌" sortKey="brand" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="SKU" sortKey="sku" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="中文名" sortKey="product_name_cn" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="展示名" sortKey="display_name" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="英文名" sortKey="product_name_en" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="库位" sortKey="shelf_location" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="库存" sortKey="quantity_on_hand" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </th>

              <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                <SortHeader label="状态" sortKey="status" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500 dark:text-gray-400">
                  没有符合条件的库存
                </td>
              </tr>
            ) : (
              sortedProducts.map((product) => {
                const inv = getInventoryRecord(product)
                const quantity = Number(inv?.quantity_on_hand || 0)
                const status = getStatus(product)
                const shelfLocation = inv?.shelf_location || ''

                let statusClass =
                  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'

                if (status === '无库存') {
                  statusClass =
                    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                } else if (status === '低库存') {
                  statusClass =
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                } else if (status === '缺少库位') {
                  statusClass =
                    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                }

                return (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  >
                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {product.brand || '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 font-medium dark:border-gray-800">
                      {product.sku}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {product.product_name_cn || '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {product.display_name || '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {product.product_name_en || '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      {shelfLocation || '-'}
                    </td>

                    <td className="border-b border-gray-200 p-3 font-medium dark:border-gray-800">
                      {quantity}
                    </td>

                    <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                      <span className={`rounded px-2 py-1 ${statusClass}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
