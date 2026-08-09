'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type Props = {
  orderId: string
  status: string
  itemCount: number
}

type RecalculationResult = {
  error?: string
  updated?: number
  available?: number
  insufficient?: number
  needsReview?: number
}

export default function RecalculateOrderItemsButton({
  orderId,
  status,
  itemCount,
}: Props) {
  const router = useRouter()
  const { notify } = useFeedback()
  const [loading, setLoading] = useState(false)

  const canRecalculate = status === 'uploaded' || status === 'need_review'
  const disabled = loading || !canRecalculate || itemCount === 0

  async function handleRecalculate() {
    if (!canRecalculate) {
      notify({
        type: 'info',
        title: '当前订单不能重新计算库存预判',
      })
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/orders/recalculate-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
      })
      const data = (await res.json()) as RecalculationResult

      if (!res.ok) {
        notify({
          type: 'error',
          title: '重新计算失败',
          message: data.error,
        })
        return
      }

      const details = [
        `已更新 ${data.updated || 0} 项`,
        data.insufficient ? `库存不足 ${data.insufficient} 项` : null,
        data.needsReview ? `需确认 ${data.needsReview} 项` : null,
      ]
        .filter(Boolean)
        .join('，')

      notify({
        type: data.insufficient || data.needsReview ? 'warning' : 'success',
        title: '订单商品明细已重新计算',
        message: details,
      })
      router.refresh()
    } catch (error) {
      notify({
        type: 'error',
        title: '重新计算失败',
        message: error instanceof Error ? error.message : '网络请求失败',
      })
    } finally {
      setLoading(false)
    }
  }

  function getTitle() {
    if (itemCount === 0) return '订单还没有商品'
    if (!canRecalculate) return '只有待确认订单可以重新计算库存预判'
    return '按最新库存重新计算库位、拣货数量和库存变化'
  }

  return (
    <button
      type="button"
      onClick={handleRecalculate}
      disabled={disabled}
      title={getTitle()}
      className="inline-flex items-center justify-center gap-2 rounded border border-blue-200 bg-white px-4 py-2 text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/60 dark:bg-gray-900 dark:text-blue-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
      </svg>
      {loading ? '重新计算中...' : '刷新库存预判'}
    </button>
  )
}
