'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type Props = {
  itemId: string
  orderStatus: string
  currentQty: number
  currentUnit: string
}

export default function EditOrderItemButton({
  itemId,
  orderStatus,
  currentQty,
  currentUnit,
}: Props) {
  const router = useRouter()
  const { notify } = useFeedback()

  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(currentQty || 1)
  const [unit, setUnit] = useState(currentUnit || '支')
  const [loading, setLoading] = useState(false)

  const disabled =
    loading ||
    orderStatus === 'completed' ||
    orderStatus === 'cancelled'

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'

  async function handleSave() {
    if (orderStatus === 'completed') {
      notify({ type: 'warning', title: '这个订单已经完成，不能修改商品' })
      return
    }

    if (orderStatus === 'cancelled') {
      notify({ type: 'warning', title: '这个订单已经取消，不能修改商品' })
      return
    }

    if (!qty || qty <= 0) {
      notify({ type: 'warning', title: '请输入正确数量' })
      return
    }

    setLoading(true)

    const res = await fetch('/api/order-items/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId,
        qty,
        unit,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      notify({
        type: 'error',
        title: '修改失败',
        message: data.error,
      })
      return
    }

    notify({ type: 'success', title: '商品数量已保存' })
    setOpen(false)
    router.refresh()
  }

  function getDisabledTitle() {
    if (orderStatus === 'completed') return '已完成订单不能修改'
    if (orderStatus === 'cancelled') return '已取消订单不能修改'
    if (orderStatus === 'picking') return '修改后会同步调整预扣库存，并进入拣货修改中'
    if (orderStatus === 'picking_editing') return '修改后会同步调整预扣库存'
    return '修改数量'
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={getDisabledTitle()}
        className="
          inline-flex h-8 w-8 items-center justify-center rounded-full
          border border-blue-200 text-blue-600
          transition hover:border-blue-300 hover:bg-blue-50 active:scale-95
          disabled:cursor-not-allowed disabled:opacity-40
          dark:border-blue-900/60 dark:text-blue-400
          dark:hover:border-blue-700 dark:hover:bg-blue-900/30
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/70">
          <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
            <h3 className="mb-4 text-lg font-semibold">修改商品数量</h3>

            <div className="space-y-4">
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
                  <option value="条">条</option>
                </select>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                选择“盒”或“条”时，系统会按商品设置的拣货倍数计算实际库存扣减。
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                取消
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
