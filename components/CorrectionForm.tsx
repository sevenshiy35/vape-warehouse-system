'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductPicker from '@/components/ProductPicker'
import { useFeedback } from '@/components/FeedbackProvider'
import { getInventoryRecord, type ProductWithInventory } from '@/lib/types'

const DEFAULT_OPERATOR = 'Seven'

type Props = {
  products: ProductWithInventory[]
}

export default function CorrectionForm({ products }: Props) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()

  const [productId, setProductId] = useState('')
  const [actualQty, setActualQty] = useState(0)
  const [shelfLocation, setShelfLocation] = useState('')
  const [operator, setOperator] = useState(DEFAULT_OPERATOR)
  const [reason, setReason] = useState('Inventory correction')
  const [loading, setLoading] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)

  const selectedInventory = selectedProduct
    ? getInventoryRecord(selectedProduct)
    : null

  const beforeQty = Number(selectedInventory?.quantity_on_hand || 0)
  const changeQty = actualQty - beforeQty

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!productId) {
      notify({ type: 'warning', title: '请选择商品' })
      return
    }

    if (!Number.isInteger(actualQty) || actualQty < 0) {
      notify({ type: 'warning', title: '实际库存必须是 0 或更大的整数' })
      return
    }

    if (actualQty > 0 && !selectedInventory?.shelf_location && !shelfLocation.trim()) {
      notify({
        type: 'warning',
        title: '修正后库存大于 0，但当前没有库位，请填写库位',
      })
      return
    }

    const ok = await confirm({
      title: '确认修正库存？',
      message: `当前库存：${beforeQty}\n实际库存：${actualQty}\n变化：${
        changeQty > 0 ? '+' : ''
      }${changeQty}`,
      confirmText: '确认修正',
    })

    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/inventory/correction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        actualQty,
        shelfLocation,
        operator,
        reason,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      notify({
        type: 'error',
        title: '库存修正失败',
        message: data.error,
      })
      return
    }

    notify({ type: 'success', title: '库存修正成功' })
    setProductId('')
    setActualQty(0)
    setShelfLocation('')
    setReason('Inventory correction')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <h2 className="text-lg font-semibold">库存盘点修正</h2>

      <ProductPicker
  products={products}
  value={productId}
  onChange={setProductId}
  label="选择修正商品"
  onProductChange={(product) => {
    const inv = product ? getInventoryRecord(product) : null

    setActualQty(Number(inv?.quantity_on_hand || 0))
  }}
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
            {beforeQty}
          </p>

          <p>
            <span className="text-gray-500 dark:text-gray-400">当前库位：</span>
            {selectedInventory?.shelf_location || '无库位'}
          </p>

          <p>
            <span className="text-gray-500 dark:text-gray-400">本次变化：</span>
            <span
              className={
                changeQty < 0
                  ? 'font-medium text-red-600 dark:text-red-400'
                  : changeQty > 0
                  ? 'font-medium text-green-700 dark:text-green-400'
                  : 'text-gray-700 dark:text-gray-300'
              }
            >
              {changeQty > 0 ? `+${changeQty}` : changeQty}
            </span>
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          实际库存
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={actualQty}
          onChange={(e) => setActualQty(Number(e.target.value))}
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
          placeholder="不填则沿用当前库位；实际库存为 0 时会自动清空库位"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          修正原因
        </label>
        <input
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例如 盘点修正 / 库存清点错误 / 损耗"
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
          placeholder="例如 Seven"
        />
      </div>

      <button
        disabled={loading}
        className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700 disabled:opacity-50 dark:bg-yellow-500 dark:text-gray-950 dark:hover:bg-yellow-400"
      >
        {loading ? '修正中...' : '确认修正'}
      </button>
    </form>
  )
}
