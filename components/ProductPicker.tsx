'use client'

import { useMemo, useState } from 'react'

type Inventory = {
  shelf_location: string | null
  quantity_on_hand: number
}

type Product = {
  id: string
  sku: string
  brand: string
  product_name_cn: string
  product_name_en: string | null
  display_name: string | null
  inventory?: Inventory | Inventory[] | null
}

type Props = {
  products: Product[]
  value: string
  onChange: (productId: string) => void
  onProductChange?: (product: Product | null) => void
  label?: string
}

const RESULT_LIMIT = 40

function getInventory(product: Product) {
  return Array.isArray(product.inventory)
    ? product.inventory[0] || null
    : product.inventory || null
}

function getProductTitle(product: Product) {
  return (
    product.display_name ||
    product.product_name_cn ||
    product.product_name_en ||
    product.sku
  )
}

function getSearchText(product: Product) {
  const inv = getInventory(product)

  return [
    product.sku,
    product.brand,
    product.product_name_cn,
    product.product_name_en,
    product.display_name,
    inv?.shelf_location,
    String(inv?.quantity_on_hand ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export default function ProductPicker({
  products,
  value,
  onChange,
  onProductChange,
  label = '选择商品',
}: Props) {
  const [brandFilter, setBrandFilter] = useState('全部')
  const [search, setSearch] = useState('')

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value) || null,
    [products, value]
  )

  const brands = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((product) => product.brand).filter(Boolean))
    )

    return ['全部', ...unique.sort()]
  }, [products])

  const filteredProducts = useMemo(() => {
    const keywords = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)

    return products.filter((product) => {
      if (brandFilter !== '全部' && product.brand !== brandFilter) {
        return false
      }

      if (keywords.length === 0) return true

      const searchableText = getSearchText(product)

      return keywords.every((keyword) => searchableText.includes(keyword))
    })
  }, [products, brandFilter, search])

  const visibleProducts = filteredProducts.slice(0, RESULT_LIMIT)

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  function selectProduct(product: Product) {
    onChange(product.id)
    onProductChange?.(product)
  }

  function clearSelection() {
    onChange('')
    onProductChange?.(null)
  }

  function handleBrandChange(nextBrand: string) {
    setBrandFilter(nextBrand)
    setSearch('')

    if (
      selectedProduct &&
      nextBrand !== '全部' &&
      selectedProduct.brand !== nextBrand
    ) {
      clearSelection()
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            品牌
          </label>

          <select
            className={inputClass}
            value={brandFilter}
            onChange={(event) => handleBrandChange(event.target.value)}
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
            搜索商品
          </label>

          <input
            className={inputClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onInput={(event) => setSearch(event.currentTarget.value)}
            placeholder="SKU / 品名 / 英文名 / 展示名 / 库位 / 库存"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {label}
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            当前匹配 {filteredProducts.length} 个商品
            {filteredProducts.length > RESULT_LIMIT
              ? `，显示前 ${RESULT_LIMIT} 个`
              : ''}
          </p>
        </div>

        {selectedProduct && (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/30">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-blue-900 dark:text-blue-200">
                  已选：{getProductTitle(selectedProduct)}
                </p>

                <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
                  {selectedProduct.brand} | {selectedProduct.sku}
                  {selectedProduct.product_name_en
                    ? ` | ${selectedProduct.product_name_en}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-950"
              >
                清除选择
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          {visibleProducts.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
              没有匹配的商品
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {visibleProducts.map((product) => {
                const inv = getInventory(product)
                const stock = Number(inv?.quantity_on_hand ?? 0)
                const location = inv?.shelf_location || '无库位'
                const selected = product.id === value
                const lowStock = stock <= 3

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className={`block w-full p-3 text-left transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:hover:bg-blue-950/30 ${
                      selected
                        ? 'bg-blue-50 dark:bg-blue-950/40'
                        : 'bg-white dark:bg-gray-950'
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            {product.brand || '-'}
                          </span>

                          <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {product.sku || '-'}
                          </span>

                          {selected && (
                            <span className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                              已选择
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-base font-semibold text-gray-950 dark:text-gray-50">
                          {getProductTitle(product)}
                        </p>

                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {product.product_name_cn || '-'}
                          {product.product_name_en
                            ? ` / ${product.product_name_en}`
                            : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm md:w-40">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-900">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            库位
                          </p>
                          <p className="truncate font-semibold">{location}</p>
                        </div>

                        <div
                          className={`rounded-lg border px-2 py-1.5 ${
                            lowStock
                              ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/60 dark:bg-yellow-950/30'
                              : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900'
                          }`}
                        >
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            库存
                          </p>
                          <p className="font-semibold">{stock}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
