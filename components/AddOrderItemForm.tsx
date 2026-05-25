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
  orderId: string
  products: Product[]
}

export default function AddOrderItemForm({ orderId, products }: Props) {
  const router = useRouter()

  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState('支')
  const [loading, setLoading] = useState(false)

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()

    if (!productId) {
      alert('请选择商品')
      return
    }

    if (!qty || qty <= 0) {
      alert('请输入正确数量')
      return
    }

    setLoading(true)

    const res = await fetch('/api/order-items/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        productId,
        qty,
        unit,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      alert('添加失败：' + data.error)
      return
    }

    setProductId('')
    setQty(1)
    setUnit('支')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleAddItem}
      className="space-y-4 rounded border border-gray-200 bg-white p-5 text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <h2 className="text-lg font-semibold">手动添加商品</h2>

      <ProductPicker
  products={products}
  value={productId}
  onChange={setProductId}
  label="选择商品"
/>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            数量
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
            单位
          </label>
          <select
            className={inputClass}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="支">支</option>
            <option value="盒">盒</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        规则：如果选择 Yohuu烟弹 且单位为“盒”，系统会自动按 1盒 = 实际拣货3 计算。
      </p>

      <button
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
      >
        {loading ? '添加中...' : '添加商品'}
      </button>
    </form>
  )
}