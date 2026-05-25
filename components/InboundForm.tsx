'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductPicker from '@/components/ProductPicker'

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
}

export default function InboundForm({ products }: Props) {
  const router = useRouter()

  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [shelfLocation, setShelfLocation] = useState('')
  const [operator, setOperator] = useState('admin')
  const [loading, setLoading] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)

  const selectedInventory = selectedProduct
    ? Array.isArray((selectedProduct as any).inventory)
      ? (selectedProduct as any).inventory[0]
      : (selectedProduct as any).inventory
    : null

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!productId) {
      alert('请选择商品')
      return
    }

    if (!qty || qty <= 0) {
      alert('请输入正确的入库数量')
      return
    }

    if (!selectedInventory?.shelf_location && !shelfLocation.trim()) {
      alert('这个商品当前没有库位，请填写新库位')
      return
    }

    const ok = window.confirm('确认入库吗？确认后库存会增加，并写入库存流水。')
    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/inventory/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        qty,
        shelfLocation,
        operator,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      alert('入库失败：' + data.error)
      return
    }

    alert('入库成功')
    setProductId('')
    setQty(1)
    setShelfLocation('')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <h2 className="text-lg font-semibold">新增入库</h2>

      <ProductPicker
  products={products}
  value={productId}
  onChange={setProductId}
  label="选择入库商品"
/>

      {selectedProduct && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          <p>
            <span className="text-gray-500 dark:text-gray-400">当前商品：</span>
            {selectedProduct.brand} | {selectedProduct.sku} |{' '}
            {selectedProduct.product_name_cn}
          </p>

          <p>
            <span className="text-gray-500 dark:text-gray-400">当前库存：</span>
            {selectedInventory?.quantity_on_hand ?? 0}
          </p>

          <p>
            <span className="text-gray-500 dark:text-gray-400">当前库位：</span>
            {selectedInventory?.shelf_location || '无库位，需要填写'}
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          入库数量
        </label>
        <input
          type="number"
          min={1}
          className={inputClass}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          新库位，可选
        </label>
        <input
          className={inputClass}
          value={shelfLocation}
          onChange={(e) => setShelfLocation(e.target.value)}
          placeholder="如果不填，会沿用当前库位；当前无库位时必须填写"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          操作人
        </label>
        <input
          className={inputClass}
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          placeholder="例如 admin / Seven"
        />
      </div>

      <button
        disabled={loading}
        className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
      >
        {loading ? '入库中...' : '确认入库'}
      </button>
    </form>
  )
}
