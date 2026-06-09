'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type Props = {
  orderId: string
  orderStatus: string
  productId: string | null | undefined
  productName: string
  rawText: string
  quantity: number | null | undefined
  unit: string | null | undefined
  matchStatus: string | null | undefined
  alreadyAdded: boolean
}

export default function ConfirmAiOrderItemButton({
  orderId,
  orderStatus,
  productId,
  productName,
  rawText,
  quantity,
  unit,
  matchStatus,
  alreadyAdded,
}: Props) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()
  const [loading, setLoading] = useState(false)

  const locked = orderStatus === 'completed' || orderStatus === 'cancelled'
  const canConfirm =
    !locked &&
    !alreadyAdded &&
    matchStatus === 'need_review' &&
    Boolean(productId) &&
    Boolean(quantity && quantity > 0)

  async function handleConfirm() {
    if (locked) {
      notify({ type: 'warning', title: '当前订单状态不能添加商品' })
      return
    }

    if (alreadyAdded) {
      notify({ type: 'info', title: '这个商品已经在订单明细里' })
      return
    }

    if (matchStatus !== 'need_review') {
      notify({ type: 'warning', title: '只有需确认的AI候选商品可以这样加入' })
      return
    }

    if (!productId || !quantity || quantity <= 0) {
      notify({ type: 'warning', title: 'AI候选商品信息不完整，不能直接加入' })
      return
    }

    const normalizedUnit = unit && unit !== '未知' ? unit : '支'

    const ok = await confirm({
      title: '确认加入这个AI候选商品？',
      message: `${rawText || productName}\n\n将加入：${productName}\n数量：${quantity} ${normalizedUnit}`,
      confirmText: '确认加入',
      tone: 'success',
    })

    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/order-items/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        productId,
        qty: quantity,
        unit: normalizedUnit,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      notify({
        type: 'error',
        title: '加入失败',
        message: data.error,
      })
      return
    }

    notify({ type: 'success', title: 'AI候选商品已加入订单' })
    router.refresh()
  }

  if (alreadyAdded) {
    return (
      <span className="inline-flex min-h-9 items-center rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
        已在明细
      </span>
    )
  }

  if (matchStatus !== 'need_review') {
    return <span className="text-gray-400 dark:text-gray-500">-</span>
  }

  return (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={!canConfirm || loading}
      title={
        canConfirm
          ? '确认后会加入订单商品明细'
          : '缺少匹配商品或当前订单不能添加'
      }
      className="inline-flex min-h-9 items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
    >
      {loading ? '加入中...' : '确认加入'}
    </button>
  )
}
