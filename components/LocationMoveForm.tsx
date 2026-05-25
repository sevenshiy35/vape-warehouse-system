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

export default function LocationMoveForm({ products }: Props) {
  const router = useRouter()

  const [productId, setProductId] = useState('')
  const [newShelfLocation, setNewShelfLocation] = useState('')
  const [operator, setOperator] = useState('admin')
  const [reason, setReason] = useState('Location move')
  const [loading, setLoading] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)

  const selectedInventory = selectedProduct
    ? Array.isArray((selectedProduct as any).inventory)
      ? (selectedProduct as any).inventory[0]
      : (selectedProduct as any).inventory
    : null

  const currentQty = Number(selectedInventory?.quantity_on_hand || 0)
  const currentShelf = selectedInventory?.shelf_location || ''

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!productId) {
      alert('请选择商品')
      return
    }

    if (currentQty <= 0) {
      alert('这个商品当前库存为 0，不能挪动库位')
      return
    }

    if (!newShelfLocation.trim()) {
      alert('请输入新库位')
      return
    }

    if (newShelfLocation.trim() === currentShelf) {
      alert('新库位和当前库位一样')
      return
    }

    const ok = window.confirm(
      `确认挪动库位吗？\n\n商品：${selectedProduct?.brand} | ${selectedProduct?.sku} | ${selectedProduct?.product_name_cn}\n库存数量：${currentQty}\n旧库位：${currentShelf || '无库位'}\n新库位：${newShelfLocation.trim()}`
    )

    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/inventory/location-move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        newShelfLocation,
        operator,
        reason,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      alert('库位挪动失败：' + data.error)
      return
    }

    alert('库位挪动成功')
    setProductId('')
    setNewShelfLocation('')
    setReason('Location move')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <h2 className="text-lg font-semibold">库位挪动</h2>

      <ProductPicker
  products={products}
  value={productId}
  onChange={(id) => {
    setProductId(id)
    setNewShelfLocation('')
  }}
  label="选择挪动商品"
/>

      {selectedProduct && (
        <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          <p>
            <span className="text-gray-500 dark:text-gray-400">当前商品：</span>
            {selectedProduct.brand} | {selectedProduct.sku} |{' '}
            {selectedProduct.product_name_cn}
          </p>

          <p>
            <span className="text-gray-500 dark:text-gray-400">当前库存：</span>
            {currentQty}
          </p>

          <p>
            <span className="text-gray-500 dark:text-gray-400">当前库位：</span>
            {currentShelf || '无库位'}
          </p>

          {currentQty <= 0 && (
            <p className="font-medium text-red-600 dark:text-red-400">
              当前库存为 0，不能挪动库位。库存为 0 的商品库位应保持为空。
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          新库位
        </label>
        <input
          className={inputClass}
          value={newShelfLocation}
          onChange={(e) => setNewShelfLocation(e.target.value)}
          placeholder="例如 A1-03 / SP区-2层"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          挪动原因
        </label>
        <input
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例如 重新整理货架 / 库位调整"
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
        disabled={loading || !productId || currentQty <= 0}
        className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50 dark:bg-purple-500 dark:text-white dark:hover:bg-purple-400"
      >
        {loading ? '挪动中...' : '确认挪动库位'}
      </button>
    </form>
  )
}
