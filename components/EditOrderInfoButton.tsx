'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type Props = {
  orderId: string
  status: string
  currentCustomerName: string | null
  currentAddress: string | null
  currentNote: string | null
}

export default function EditOrderInfoButton({
  orderId,
  status,
  currentCustomerName,
  currentAddress,
  currentNote,
}: Props) {
  const router = useRouter()
  const { notify } = useFeedback()

  const [open, setOpen] = useState(false)
  const [customerName, setCustomerName] = useState(currentCustomerName || '')
  const [address, setAddress] = useState(currentAddress || '')
  const [note, setNote] = useState(currentNote || '')
  const [loading, setLoading] = useState(false)

  const disabled =
    loading || status === 'completed' || status === 'cancelled'

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  async function handleSave() {
    if (status === 'completed') {
      notify({ type: 'warning', title: '已完成订单不能修改订单信息' })
      return
    }

    if (status === 'cancelled') {
      notify({ type: 'warning', title: '已取消订单不能修改订单信息' })
      return
    }

    if (!address.trim()) {
      notify({ type: 'warning', title: '地址不能为空' })
      return
    }

    setLoading(true)

    const res = await fetch('/api/orders/update-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        customerName,
        address,
        note,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      notify({
        type: 'error',
        title: '保存失败',
        message: data.error,
      })
      return
    }

    notify({ type: 'success', title: '订单信息已保存' })
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        编辑订单信息
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/70">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
            <h3 className="mb-4 text-lg font-semibold">编辑订单信息</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  客户名
                </label>
                <input
                  className={inputClass}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="可选"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  地址
                </label>
                <textarea
                  className={`${inputClass} min-h-24`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="例如：615 Pavonia Avenue, Unit #4406"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  备注
                </label>
                <textarea
                  className={`${inputClass} min-h-20`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="门禁、到店备注、特殊说明"
                />
              </div>
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
