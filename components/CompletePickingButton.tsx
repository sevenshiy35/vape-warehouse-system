'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  orderId: string
  status: string
}

export default function CompletePickingButton({ orderId, status }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleComplete() {
    if (status !== 'picking') {
      alert('只有拣货中的订单可以完成拣货')
      return
    }

    const ok = window.confirm('确认这个订单已经拣货完毕吗？确认后订单状态会变成 completed。')
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
      alert('完成拣货失败：' + data.error)
      return
    }

    alert('拣货完成')
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