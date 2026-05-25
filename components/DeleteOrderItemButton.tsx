'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  itemId: string
  orderStatus: string
}

export default function DeleteOrderItemButton({ itemId, orderStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const disabled =
    loading ||
    orderStatus === 'completed' ||
    orderStatus === 'cancelled'

  async function handleDelete() {
    if (orderStatus === 'completed') {
      alert('这个订单已经完成，不能删除商品')
      return
    }

    if (orderStatus === 'cancelled') {
      alert('这个订单已经取消，不能删除商品')
      return
    }

    const ok = window.confirm('确认删除这个商品吗？')
    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/order-items/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      alert('删除失败：' + data.error)
      return
    }

    router.refresh()
  }

  function getDisabledTitle() {
    if (orderStatus === 'completed') return '已完成订单不能删除'
    if (orderStatus === 'cancelled') return '已取消订单不能删除'
    if (orderStatus === 'picking') return '拣货中订单不能删除'
    return '删除商品'
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={disabled}
      title={getDisabledTitle()}
      className="
        inline-flex h-8 w-8 items-center justify-center rounded-full
        border border-red-200 text-red-600
        transition hover:border-red-300 hover:bg-red-50 active:scale-95
        disabled:cursor-not-allowed disabled:opacity-40
        dark:border-red-900/60 dark:text-red-400
        dark:hover:border-red-700 dark:hover:bg-red-900/30
      "
    >
      {loading ? (
        <span className="text-xs">...</span>
      ) : (
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
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      )}
    </button>
  )
}