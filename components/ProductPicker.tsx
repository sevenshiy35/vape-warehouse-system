'use client'

import { useMemo, useState } from 'react'

type Product = {
  id: string
  sku: string
  brand: string
  product_name_cn: string
  product_name_en: string | null
  display_name: string | null
  inventory?: {
    shelf_location: string | null
    quantity_on_hand: number
  } | null
}

type Props = {
  products: Product[]
  value: string
  onChange: (productId: string) => void
  onProductChange?: (product: Product | null) => void
  label?: string
}

function getInventory(product: any) {
  return Array.isArray(product.inventory)
    ? product.inventory[0]
    : product.inventory
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

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  const brands = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((p) => p.brand).filter(Boolean))
    )

    return ['全部', ...unique.sort()]
  }, [products])

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return products.filter((product) => {
      if (brandFilter !== '全部' && product.brand !== brandFilter) {
        return false
      }

      if (!keyword) return true

      const text = [
        product.sku,
        product.brand,
        product.product_name_cn,
        product.product_name_en,
        product.display_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return text.includes(keyword)
    })
  }, [products, brandFilter, search])

  function handleBrandChange(nextBrand: string) {
    setBrandFilter(nextBrand)
    setSearch('')
    onChange('')
    onProductChange?.(null)
  }

  function handleProductChange(productId: string) {
    onChange(productId)

    const product = products.find((p) => p.id === productId) || null
    onProductChange?.(product)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          品牌
        </label>

        <select
          className={inputClass}
          value={brandFilter}
          onChange={(e) => handleBrandChange(e.target.value)}
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索 SKU / 中文名 / 英文名"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
        </label>

        <select
          className={inputClass}
          value={value}
          onChange={(e) => handleProductChange(e.target.value)}
        >
          <option value="">请选择商品</option>

          {filteredProducts.map((product: any) => {
            const inv = getInventory(product)
            const stock = inv?.quantity_on_hand ?? 0
            const location = inv?.shelf_location || '无库位'

            return (
              <option key={product.id} value={product.id}>
                {product.brand} | {product.sku} | {product.product_name_cn}
                {product.product_name_en ? ` / ${product.product_name_en}` : ''}
                {` | 库存:${stock} | 库位:${location}`}
              </option>
            )
          })}
        </select>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          当前显示 {filteredProducts.length} 个商品
        </p>
      </div>
    </div>
  )
}