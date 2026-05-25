'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type Props = {
  orderId: string
  status: string
}

export default function SavePickingEditButton({ orderId, status }: Props) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (status !== 'picking_editing') {
      notify({ type: 'warning', title: '只有修改中的拣货订单需要保存' })
      return
    }

    const ok = await confirm({
      title: '确认保存本次修改？',
      message: '保存后订单会回到拣货中。',
      confirmText: '保存修改',
    })
    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/orders/save-picking-edit', {
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
        title: '保存修改失败',
        message: data.error,
      })
      return
    }

    notify({ type: 'success', title: '修改已保存，订单已回到拣货中' })
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={loading || status !== 'picking_editing'}
      className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-400"
    >
      {loading ? '保存中...' : '保存修改'}
    </button>
  )
}
