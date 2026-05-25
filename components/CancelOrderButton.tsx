'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type Props = {
  orderId: string
  status: string
}

export default function CancelOrderButton({ orderId, status }: Props) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    if (status === 'cancelled') {
      notify({ type: 'info', title: '这个订单已经取消' })
      return
    }

    const message =
      status === 'completed'
        ? '这个订单已经完成。确认取消后，系统会把本单商品库存加回去，并写入 OrderReversal 流水。确认取消吗？'
        : '确认取消这个订单吗？未完成订单不会影响库存。'

    const ok = await confirm({
      title: '确认取消订单？',
      message,
      confirmText: '取消订单',
      tone: 'danger',
    })
    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/orders/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      notify({
        type: 'error',
        title: '取消订单失败',
        message: data.error,
      })
      return
    }

    notify({ type: 'success', title: '订单已取消' })
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading || status === 'cancelled'}
      className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-400"
    >
      {status === 'cancelled'
        ? '已取消'
        : loading
        ? '取消中...'
        : '取消订单'}
    </button>
  )
}
