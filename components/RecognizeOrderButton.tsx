'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type RecognizedItem = {
  rawText: string
  brand: string | null
  productName: string
  quantity: number
  unit: '支' | '盒' | '条' | '个' | '未知'
  confidence: number
  note: string | null

  matchStatus: 'matched' | 'need_review' | 'not_found'
  matchScore: number
  matchReason: string

  productId: string | null
  sku: string | null
  matchedBrand: string | null
  productNameCN: string | null
  productNameEN: string | null
  displayName: string | null
  shelfLocation: string | null
  currentStock: number | null

  secondChoice: {
    sku: string
    name: string | null
    score: number
  } | null
}

type RecognizedResult = {
  items: RecognizedItem[]
  warnings: string[]
}

type Props = {
  orderId: string
  status: string
  aiStatus?: string | null
}

const blockedRecognitionStatuses = new Set([
  'picking',
  'completed',
  'cancelled',
])

function getBlockedRecognitionMessage(status: string) {
  if (status === 'picking') return '拣货中订单不能使用AI识别'
  if (status === 'completed') return '已完成订单不能使用AI识别'
  if (status === 'cancelled') return '已取消订单不能使用AI识别'
  return '当前订单状态不能使用AI识别'
}

function getStatusClass(status: RecognizedItem['matchStatus']) {
  if (status === 'matched') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  }

  if (status === 'need_review') {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
  }

  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
}

export default function RecognizeOrderButton({
  orderId,
  status,
  aiStatus,
}: Props) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()

  const [loading, setLoading] = useState(false)
  const [addingAll, setAddingAll] = useState(false)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<RecognizedResult | null>(null)
  const [addedKeys, setAddedKeys] = useState<Record<string, boolean>>({})

  async function handleRecognize() {
    if (blockedRecognitionStatuses.has(status)) {
      notify({ type: 'warning', title: getBlockedRecognitionMessage(status) })
      return
    }

    const isRerun = aiStatus === 'completed' || aiStatus === 'failed'

    if (isRerun) {
      const ok = await confirm({
        title: '重新识别并匹配这个订单？',
        message:
          '系统会重新读取全部订单截图，并使用当前商品资料重新匹配。现有订单商品不会被自动删除或修改。',
        confirmText: '重新识别并匹配',
      })

      if (!ok) return
    }

    setLoading(true)
    setAddedKeys({})

    try {
      const res = await fetch('/api/ai/recognize-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          force: isRerun,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        notify({
          type: 'error',
          title: 'AI识别失败',
          message: data.error,
        })
        return
      }

      setResult(data.result)
      setOpen(true)
      router.refresh()

      if (isRerun) {
        notify({ type: 'success', title: '已重新识别并完成库存匹配' })
      }
    } catch (error: unknown) {
      notify({
        type: 'error',
        title: 'AI识别失败',
        message: error instanceof Error ? error.message : '网络请求失败',
      })
    } finally {
      setLoading(false)
    }
  }

  async function addItem(item: RecognizedItem, index: number) {
    if (!item.productId) {
      notify({
        type: 'warning',
        title: '这个商品没有匹配到库存 SKU，不能自动加入',
      })
      return false
    }

    if (item.matchStatus !== 'matched') {
      notify({ type: 'warning', title: '这个商品需要人工确认，请手动添加' })
      return false
    }

    const unit = item.unit === '未知' ? '支' : item.unit

    const res = await fetch('/api/order-items/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        productId: item.productId,
        qty: item.quantity,
        unit,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      notify({
        type: 'error',
        title: `添加失败：${item.rawText}`,
        message: data.error,
      })
      return false
    }

    setAddedKeys((prev) => ({
      ...prev,
      [`${item.rawText}-${index}`]: true,
    }))

    return true
  }

  async function handleAddAll() {
    if (!result) return

    const matchedItems = result.items.filter(
      (item) => item.matchStatus === 'matched' && item.productId
    )

    if (matchedItems.length === 0) {
      notify({ type: 'info', title: '没有可以一键加入的匹配成功商品' })
      return
    }

    const ok = await confirm({
      title: '确认一键加入商品？',
      message: `将把 ${matchedItems.length} 个匹配成功的商品加入订单。`,
      confirmText: '一键加入',
      tone: 'success',
    })

    if (!ok) return

    setAddingAll(true)

    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i]

      if (item.matchStatus === 'matched' && item.productId) {
        const key = `${item.rawText}-${i}`

        if (!addedKeys[key]) {
          const success = await addItem(item, i)

          if (!success) {
            setAddingAll(false)
            router.refresh()
            return
          }
        }
      }
    }

    setAddingAll(false)
    notify({ type: 'success', title: '匹配成功商品已加入订单' })
    router.refresh()
  }

  const matchedCount =
    result?.items.filter((item) => item.matchStatus === 'matched' && item.productId)
      .length || 0
  const recognitionBlocked = blockedRecognitionStatuses.has(status)
  const isRerun = aiStatus === 'completed' || aiStatus === 'failed'

  return (
    <>
      <button
        type="button"
        onClick={handleRecognize}
        disabled={loading || recognitionBlocked}
        title={recognitionBlocked ? getBlockedRecognitionMessage(status) : undefined}
        className="rounded bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50 dark:bg-purple-500 dark:hover:bg-purple-400"
      >
        {loading
          ? isRerun
            ? '重新识别中...'
            : '识别中...'
          : isRerun
            ? '重新识别并匹配'
            : 'AI识别订单'}
      </button>

      {open && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/70">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">AI识别与库存匹配结果</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  先检查匹配结果，确认后再加入订单。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddAll}
                  disabled={addingAll || matchedCount === 0}
                  className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-500"
                >
                  {addingAll
                    ? '加入中...'
                    : `一键加入匹配成功商品 (${matchedCount})`}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    router.refresh()
                  }}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  关闭
                </button>
              </div>
            </div>

            {result.items.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                没有识别到商品。
              </p>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-800">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        AI识别
                      </th>
                      <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        数量
                      </th>
                      <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        匹配状态
                      </th>
                      <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        匹配SKU
                      </th>
                      <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        库位/库存
                      </th>
                      <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        匹配原因
                      </th>
                      <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        操作
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.items.map((item, index) => {
                      const key = `${item.rawText}-${index}`
                      const added = addedKeys[key]

                      return (
                        <tr
                          key={key}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                        >
                          <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                            <div className="font-medium">{item.rawText}</div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              AI商品名：{item.productName}
                              {item.brand ? ` / 品牌：${item.brand}` : ''}
                            </div>
                          </td>

                          <td className="whitespace-nowrap border-b border-gray-200 p-3 text-lg font-bold dark:border-gray-800">
                            {item.quantity} {item.unit}
                          </td>

                          <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                            <span
                              className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(
                                item.matchStatus
                              )}`}
                            >
                              {item.matchStatus}
                            </span>

                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              分数：{item.matchScore}
                            </div>
                          </td>

                          <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                            {item.productId ? (
                              <div>
                                <div className="font-semibold">
                                  {item.matchedBrand || '-'} / {item.sku}
                                </div>
                                <div className="mt-1 text-sm">
                                  {item.productNameCN || '-'}
                                </div>
                                {item.productNameEN && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {item.productNameEN}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-red-600 dark:text-red-400">
                                未匹配
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                            <div>
                              库位：
                              <span className="font-semibold">
                                {item.shelfLocation || '需要确认'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              当前库存：{item.currentStock ?? '-'}
                            </div>
                          </td>

                          <td className="border-b border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                            {item.matchReason}

                            {item.secondChoice && (
                              <div className="mt-1">
                                第二候选：{item.secondChoice.sku} /{' '}
                                {item.secondChoice.name || '-'} / 分数{' '}
                                {item.secondChoice.score}
                              </div>
                            )}
                          </td>

                          <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                            {added ? (
                              <span className="rounded bg-green-100 px-2 py-1 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                已加入
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addItem(item, index)}
                                disabled={
                                  item.matchStatus !== 'matched' ||
                                  !item.productId ||
                                  addingAll
                                }
                                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                              >
                                加入订单
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-300">
                <p className="mb-2 font-semibold">识别 / 匹配提醒</p>
                <ul className="list-disc space-y-1 pl-5">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
              matched 可以自动加入订单；need_review / not_found 建议用页面下方的手动添加商品功能确认。
            </div>
          </div>
        </div>
      )}
    </>
  )
}
