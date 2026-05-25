'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  orderId: string
  status: string
}

export default function ConfirmOrderButton({ orderId, status }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (status === 'completed') {
      alert('这个订单已经完成，不能重复确认')
      return
    }

    if (status === 'picking') {
      alert('这个订单已经在拣货中')
      return
    }

    if (status === 'cancelled') {
      alert('这个订单已经取消，不能确认')
      return
    }
    if (status === 'picking_editing') {
      alert('修改中')
      return
    }

    const ok = window.confirm(
      '确认订单并生成拣货单吗？确认后库存会先扣减/预留，订单状态变成“拣货中”。'
    )

    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/orders/confirm', {
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
      alert('确认订单失败：' + data.error)
      return
    }

    alert('订单已确认，已进入拣货中')
    router.refresh()
  }

 const disabled =
  loading ||
  status === 'completed' ||
  status === 'picking' ||
  status === 'picking_editing' ||
  status === 'cancelled'

  return (
    <button
      onClick={handleConfirm}
      disabled={disabled}
      className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-500"
    >
      {status === 'completed'
        ? '已完成'
        : status === 'picking'
        ? '拣货中'
        : status === 'cancelled'
        ? '已取消'
        : loading
        ? '确认中...'
        : '确认订单'}
    </button>
  )
}