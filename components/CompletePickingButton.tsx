'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type Props = {
  orderId: string
  status: string
}

export default function CompletePickingButton({ orderId, status }: Props) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()
  const [loading, setLoading] = useState(false)

  async function handleComplete() {
    if (status !== 'picking') {
      notify({ type: 'warning', title: '只有拣货中的订单可以完成拣货' })
      return
    }

    const ok = await confirm({
      title: '确认拣货完成？',
      message: '确认后订单状态会变成 completed。',
      confirmText: '完成拣货',
      tone: 'success',
    })
    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/orders/complete-picking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      notify({
        type: 'error',
        title: '完成拣货失败',
        message: data.error,
      })
      return
    }

    notify({ type: 'success', title: '拣货完成' })
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleComplete}
      disabled={loading || status !== 'picking'}
      className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
    >
      {loading ? '处理中...' : '完成拣货'}
    </button>
  )
}
