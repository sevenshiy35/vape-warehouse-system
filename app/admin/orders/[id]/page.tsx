import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import AddOrderItemForm from '@/components/AddOrderItemForm'
import ConfirmOrderButton from '@/components/ConfirmOrderButton'
import CompletePickingButton from '@/components/CompletePickingButton'
import SavePickingEditButton from '@/components/SavePickingEditButton'
import CancelOrderButton from '@/components/CancelOrderButton'
import DeleteOrderItemButton from '@/components/DeleteOrderItemButton'
import EditOrderItemButton from '@/components/EditOrderItemButton'
import EditOrderInfoButton from '@/components/EditOrderInfoButton'
import RecognizeOrderButton from '@/components/RecognizeOrderButton'
import AddOrderImagesButton from '@/components/AddOrderImagesButton'
import { NavButton, PageHeader, PageShell, Panel } from '@/components/PageChrome'
import type { ProductWithInventory } from '@/lib/types'
import { formatEasternTime } from '@/lib/time'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

const orderFlowSteps = [
  {
    key: 'uploaded',
    label: '已上传',
    description: '截图与地址已提交',
    statuses: ['uploaded'],
  },
  {
    key: 'review',
    label: '核对商品',
    description: '识别或手动添加商品',
    statuses: ['need_review'],
  },
  {
    key: 'picking',
    label: '拣货中',
    description: '库存已预扣',
    activeLabel: '修改中',
    activeDescription: '保存修改后继续拣货',
    statuses: ['picking', 'picking_editing'],
  },
  {
    key: 'completed',
    label: '已完成',
    description: '拣货结束',
    statuses: ['completed'],
  },
]

function getOrderFlowIndex(status: string) {
  const index = orderFlowSteps.findIndex((step) =>
    step.statuses.includes(status)
  )

  return index >= 0 ? index : 0
}

function getOrderActionVisibility(status: string, aiStatus?: string | null) {
  const isEditable = status !== 'completed' && status !== 'cancelled'
  const isReviewing = status === 'uploaded' || status === 'need_review'
  const isPicking = status === 'picking'
  const isPickingEditing = status === 'picking_editing'
  const isAiProcessing = aiStatus === 'processing'
  const aiCanRun = aiStatus !== 'processing' && aiStatus !== 'completed'

  return {
    canRecognize: (isReviewing || isPickingEditing) && aiCanRun,
    canEditInfo: isEditable,
    canConfirm: isReviewing && !isAiProcessing,
    canOpenPicking: isPicking || isPickingEditing,
    canCompletePicking: isPicking,
    canSavePickingEdit: isPickingEditing,
    canCancel: status !== 'cancelled',
    canEditItems: isEditable,
  }
}

type AiRawResult = {
  items?: AiResultItem[]
  warnings?: string[]
  autoAdd?: {
    attempted?: number
    added?: number
    skipped?: number
    failed?: number
    errors?: string[]
  }
  status?: string
  error?: string
}

type AiResultItem = {
  rawText?: string
  productName?: string
  quantity?: number
  unit?: string
  matchStatus?: string
  matchScore?: number
  matchReason?: string
  sku?: string | null
  matchedBrand?: string | null
  displayName?: string | null
  productNameCN?: string | null
  productNameEN?: string | null
  shelfLocation?: string | null
  currentStock?: number | null
  secondChoice?: {
    sku?: string | null
    name?: string | null
    score?: number | null
  } | null
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select(
      'id, order_no, order_type, customer_name, address, note, status, image_path, image_paths, ai_status, ai_error, ai_processed_at, ai_raw_result, created_at'
    )
    .eq('id', id)
    .single()

  if (error || !order) {
    return (
      <PageShell>
        <div className="mb-4">
          <NavButton href="/admin/orders">返回订单列表</NavButton>
        </div>

        <PageHeader title="订单详情" />

        <p className="text-red-600 dark:text-red-400">
          读取订单失败：{error?.message || 'Order not found'}
        </p>
      </PageShell>
    )
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select(`
      id,
      sku_snapshot,
      brand_snapshot,
      product_name_cn_snapshot,
      product_name_en_snapshot,
      display_name_snapshot,
      recognized_qty,
      recognized_unit,
      pick_qty,
      shelf_location_snapshot,
      before_qty,
      after_qty,
      match_status,
      created_at
    `)
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      sku,
      brand,
      product_name_cn,
      product_name_en,
      display_name,
      inventory (
        shelf_location,
        quantity_on_hand
      )
    `)
    .eq('is_active', true)
    .order('brand', { ascending: true })
    .order('sku', { ascending: true })

  const imagePaths =
    Array.isArray(order.image_paths) && order.image_paths.length > 0
      ? order.image_paths.filter(Boolean)
      : order.image_path
      ? [order.image_path]
      : []

  const signedImageUrls: {
    path: string
    url: string
  }[] = []

  for (const imagePath of imagePaths) {
    const { data: signedData, error: signedError } =
      await supabaseAdmin.storage
        .from('order-images')
        .createSignedUrl(imagePath, 60 * 10)

    if (!signedError && signedData?.signedUrl) {
      signedImageUrls.push({
        path: imagePath,
        url: signedData.signedUrl,
      })
    }
  }

  const totalPickQty = (items || []).reduce(
    (sum, item) => sum + Number(item.pick_qty || 0),
    0
  )
  const orderActions = getOrderActionVisibility(
    order.status,
    order.ai_status
  )

  function getOrderStatusClass(status: string) {
    if (status === 'completed') {
      return 'inline-block rounded bg-green-100 px-2 py-1 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    }

    if (status === 'picking') {
      return 'inline-block rounded bg-orange-100 px-2 py-1 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
    }

    if (status === 'picking_editing') {
      return 'inline-block rounded bg-purple-100 px-2 py-1 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
    }

    if (status === 'need_review') {
      return 'inline-block rounded bg-yellow-100 px-2 py-1 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
    }

    if (status === 'cancelled') {
      return 'inline-block rounded bg-red-100 px-2 py-1 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    }

    return 'inline-block rounded bg-blue-100 px-2 py-1 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  }

  function getOrderStatusLabel(status: string) {
    if (status === 'uploaded') return '已上传'
    if (status === 'need_review') return '待确认'
    if (status === 'picking') return '拣货中'
    if (status === 'picking_editing') return '拣货修改中'
    if (status === 'completed') return '已完成'
    if (status === 'cancelled') return '已取消'
    return status
  }

  function getItemStatusClass(status: string) {
    if (status === 'matched') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    }

    if (status === 'out_of_stock') {
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    }

    if (status === 'need_review') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
    }

    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }

  function getItemStatusLabel(status: string) {
    if (status === 'matched') return '已匹配'
    if (status === 'out_of_stock') return '库存不足'
    if (status === 'need_review') return '需确认'
    if (status === 'not_found') return '未匹配'
    return status
  }

  function getAiStatusLabel(status: string | null | undefined) {
    if (status === 'processing') return '识别中'
    if (status === 'completed') return '已完成'
    if (status === 'failed') return '识别失败'
    return '未开始'
  }

  function getAiStatusClass(status: string | null | undefined) {
    if (status === 'processing') {
      return 'inline-block rounded bg-blue-100 px-2 py-1 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
    }

    if (status === 'completed') {
      return 'inline-block rounded bg-green-100 px-2 py-1 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    }

    if (status === 'failed') {
      return 'inline-block rounded bg-red-100 px-2 py-1 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    }

    return 'inline-block rounded bg-gray-100 px-2 py-1 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }

  function getAutoAddSummary(value: unknown) {
    if (!value || typeof value !== 'object' || !('autoAdd' in value)) {
      return null
    }

    const autoAdd = (value as { autoAdd?: unknown }).autoAdd

    if (!autoAdd || typeof autoAdd !== 'object') return null

    const summary = autoAdd as {
      attempted?: unknown
      added?: unknown
      skipped?: unknown
      failed?: unknown
    }

    return {
      attempted: Number(summary.attempted || 0),
      added: Number(summary.added || 0),
      skipped: Number(summary.skipped || 0),
      failed: Number(summary.failed || 0),
    }
  }

  function getAiRawResult(value: unknown): AiRawResult | null {
    if (!value || typeof value !== 'object') return null

    return value as AiRawResult
  }

  function getAiMatchStatusClass(status: string | null | undefined) {
    if (status === 'matched') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    }

    if (status === 'need_review') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
    }

    if (status === 'not_found') {
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    }

    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }

  function getAiMatchStatusLabel(status: string | null | undefined) {
    if (status === 'matched') return '已匹配'
    if (status === 'need_review') return '需确认'
    if (status === 'not_found') return '未匹配'
    return status || '-'
  }

  const aiRawResult = getAiRawResult(order.ai_raw_result)
  const aiResultItems = Array.isArray(aiRawResult?.items)
    ? aiRawResult.items
    : []
  const aiWarnings = Array.isArray(aiRawResult?.warnings)
    ? aiRawResult.warnings
    : []
  const autoAddSummary = getAutoAddSummary(order.ai_raw_result)

  return (
    <PageShell>
      <div className="mb-4">
        <NavButton href="/admin/orders">返回订单列表</NavButton>
      </div>

      <PageHeader
        title="订单详情"
        description={`OrderID: ${order.order_no}`}
        actions={
          <>
            {orderActions.canRecognize && (
              <RecognizeOrderButton orderId={order.id} status={order.status} />
            )}

            {orderActions.canEditInfo && (
              <EditOrderInfoButton
                orderId={order.id}
                status={order.status}
                currentCustomerName={order.customer_name}
                currentAddress={order.address}
                currentNote={order.note}
              />
            )}

            {orderActions.canConfirm && (
              <ConfirmOrderButton orderId={order.id} status={order.status} />
            )}

            {orderActions.canCompletePicking && (
              <CompletePickingButton
                orderId={order.id}
                status={order.status}
              />
            )}

            {orderActions.canSavePickingEdit && (
              <SavePickingEditButton
                orderId={order.id}
                status={order.status}
              />
            )}

            {orderActions.canCancel && (
              <CancelOrderButton orderId={order.id} status={order.status} />
            )}
          </>
        }
      />

      <Panel className="mb-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">订单流程</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              当前状态：{getOrderStatusLabel(order.status)}
            </p>
          </div>

          {order.status === 'cancelled' && (
            <span className="inline-flex w-fit rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              订单已取消
            </span>
          )}
        </div>

        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {orderFlowSteps.map((step, index) => {
            const currentIndex = getOrderFlowIndex(order.status)
            const isCancelled = order.status === 'cancelled'
            const isActive = !isCancelled && index === currentIndex
            const isDone = !isCancelled && index < currentIndex
            const label =
              isActive && order.status === 'picking_editing'
                ? step.activeLabel ?? step.label
                : step.label
            const description =
              isActive && order.status === 'picking_editing'
                ? step.activeDescription ?? step.description
                : step.description

            const circleClass = isActive
              ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500'
              : isDone
              ? 'border-green-600 bg-green-600 text-white dark:border-green-400 dark:bg-green-500'
              : 'border-gray-300 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400'

            const itemClass = isActive
              ? 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/40'
              : isDone
              ? 'border-green-200 bg-green-50 dark:border-green-900/60 dark:bg-green-950/30'
              : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'

            return (
              <li
                key={step.key}
                className={`rounded-lg border p-3 ${itemClass}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${circleClass}`}
                  >
                    {isDone ? '✓' : index + 1}
                  </span>

                  <div className="min-w-0">
                    <p className="font-medium text-gray-950 dark:text-gray-50">
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {description}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel>
            <h2 className="mb-4 text-lg font-semibold">订单信息</h2>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">OrderID</p>
                <p className="font-medium">{order.order_no}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">订单类型</p>
                <p>{order.order_type || 'order'}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">客户名</p>
                <p>{order.customer_name || '-'}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">地址</p>
                <p>{order.address || '-'}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">备注</p>
                <p>{order.note || '-'}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">状态</p>
                <span className={getOrderStatusClass(order.status)}>
                  {getOrderStatusLabel(order.status)}
                </span>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">AI识别</p>
                <div className="mt-1 space-y-1">
                  <span className={getAiStatusClass(order.ai_status)}>
                    {getAiStatusLabel(order.ai_status)}
                  </span>

                  {order.ai_status === 'processing' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      后台正在识别商品，完成后会自动加入匹配成功的商品。
                    </p>
                  )}

                  {autoAddSummary && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      自动加入 {autoAddSummary.added} 项
                      {autoAddSummary.skipped > 0
                        ? `，跳过 ${autoAddSummary.skipped} 项`
                        : ''}
                      {autoAddSummary.failed > 0
                        ? `，失败 ${autoAddSummary.failed} 项`
                        : ''}
                    </p>
                  )}

                  {order.ai_error && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {order.ai_error}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">订单截图数量</p>
                <p>{imagePaths.length}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">创建时间</p>
                <p>
                  {formatEasternTime(order.created_at)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center justify-between gap-3">
  <h2 className="text-lg font-semibold">订单截图</h2>

  <div className="flex items-center gap-3">
    <span className="text-sm text-gray-500 dark:text-gray-400">
      共 {signedImageUrls.length} 张
    </span>

    <AddOrderImagesButton
      orderId={order.id}
      status={order.status}
    />
  </div>
</div>

            {signedImageUrls.length > 0 ? (
              <div className="space-y-5">
                {signedImageUrls.map((image, index) => (
                  <div
                    key={image.path}
                    className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">
                        截图 {index + 1}
                      </p>

                      <a
                        href={image.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        打开原图
                      </a>
                    </div>

                    <Image
                      src={image.url}
                      alt={`Order image ${index + 1}`}
                      width={1200}
                      height={1600}
                      unoptimized
                      className="w-full rounded border border-gray-200 dark:border-gray-700"
                    />

                    <p className="mt-2 break-all text-xs text-gray-400 dark:text-gray-500">
                      {image.path}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                没有找到订单图片
              </p>
            )}
          </Panel>
        </div>

        <div className="mt-6 space-y-6">
          <Panel>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">AI识别结果</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  查看AI看到的文字、匹配分数、匹配到的商品和自动加入结果。
                </p>
              </div>

              <span className={getAiStatusClass(order.ai_status)}>
                {getAiStatusLabel(order.ai_status)}
              </span>
            </div>

            {order.ai_status === 'processing' ? (
              <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                后台正在识别商品，稍后刷新页面即可查看完整结果。
              </p>
            ) : order.ai_status === 'failed' ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                <p className="font-medium">AI识别失败</p>
                <p className="mt-1">{order.ai_error || aiRawResult?.error || '-'}</p>
              </div>
            ) : aiResultItems.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                暂无AI识别结果。
              </p>
            ) : (
              <div className="space-y-4">
                {autoAddSummary && (
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                      <p className="text-gray-500 dark:text-gray-400">可自动加入</p>
                      <p className="mt-1 text-xl font-bold">
                        {autoAddSummary.attempted}
                      </p>
                    </div>

                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-950/30">
                      <p className="text-green-700 dark:text-green-300">已加入</p>
                      <p className="mt-1 text-xl font-bold text-green-800 dark:text-green-200">
                        {autoAddSummary.added}
                      </p>
                    </div>

                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-950/30">
                      <p className="text-yellow-700 dark:text-yellow-300">已跳过</p>
                      <p className="mt-1 text-xl font-bold text-yellow-800 dark:text-yellow-200">
                        {autoAddSummary.skipped}
                      </p>
                    </div>

                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                      <p className="text-red-700 dark:text-red-300">失败</p>
                      <p className="mt-1 text-xl font-bold text-red-800 dark:text-red-200">
                        {autoAddSummary.failed}
                      </p>
                    </div>
                  </div>
                )}

                {aiWarnings.length > 0 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200">
                    <p className="font-medium">提示</p>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      {aiWarnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="hidden overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 md:block">
                  <table className="w-full min-w-[1050px] text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                          AI原文
                        </th>
                        <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                          数量
                        </th>
                        <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                          状态
                        </th>
                        <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                          分数
                        </th>
                        <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                          匹配商品
                        </th>
                        <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                          匹配原因
                        </th>
                        <th className="border-b border-gray-200 p-3 text-left dark:border-gray-700">
                          第二候选
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {aiResultItems.map((item, index) => (
                        <tr
                          key={`${item.rawText || item.productName || 'ai'}-${index}`}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                        >
                          <td className="border-b border-gray-200 p-3 align-top dark:border-gray-800">
                            <div className="min-w-[180px]">
                              <p className="font-medium">
                                {item.rawText || '-'}
                              </p>
                              {item.productName && item.productName !== item.rawText && (
                                <p className="mt-1 text-gray-500 dark:text-gray-400">
                                  AI商品名：{item.productName}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="whitespace-nowrap border-b border-gray-200 p-3 align-top dark:border-gray-800">
                            {item.quantity ?? '-'} {item.unit || ''}
                          </td>

                          <td className="whitespace-nowrap border-b border-gray-200 p-3 align-top dark:border-gray-800">
                            <span
                              className={`rounded px-2 py-1 ${getAiMatchStatusClass(
                                item.matchStatus
                              )}`}
                            >
                              {getAiMatchStatusLabel(item.matchStatus)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap border-b border-gray-200 p-3 align-top font-semibold dark:border-gray-800">
                            {item.matchScore ?? '-'}
                          </td>

                          <td className="border-b border-gray-200 p-3 align-top dark:border-gray-800">
                            <div className="min-w-[190px]">
                              <p className="font-medium">
                                {item.sku || '-'}
                              </p>
                              <p className="mt-1 text-gray-700 dark:text-gray-300">
                                {item.displayName ||
                                  item.productNameCN ||
                                  item.productNameEN ||
                                  '-'}
                              </p>
                              <p className="mt-1 text-gray-500 dark:text-gray-400">
                                {item.matchedBrand || '-'} / 库位：
                                {item.shelfLocation || '需要确认'}
                              </p>
                            </div>
                          </td>

                          <td className="border-b border-gray-200 p-3 align-top dark:border-gray-800">
                            <p className="min-w-[180px] text-gray-700 dark:text-gray-300">
                              {item.matchReason || '-'}
                            </p>
                          </td>

                          <td className="border-b border-gray-200 p-3 align-top dark:border-gray-800">
                            {item.secondChoice ? (
                              <div className="min-w-[150px]">
                                <p className="font-medium">
                                  {item.secondChoice.sku || '-'}
                                </p>
                                <p className="mt-1 text-gray-500 dark:text-gray-400">
                                  {item.secondChoice.name || '-'} / 分数：
                                  {item.secondChoice.score ?? '-'}
                                </p>
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 md:hidden">
                  {aiResultItems.map((item, index) => (
                    <div
                      key={`${item.rawText || item.productName || 'ai'}-${index}`}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-bold">
                            {item.rawText || item.productName || '-'}
                          </p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {item.quantity ?? '-'} {item.unit || ''}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded px-2 py-1 text-xs ${getAiMatchStatusClass(
                            item.matchStatus
                          )}`}
                        >
                          {getAiMatchStatusLabel(item.matchStatus)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                          <p className="text-gray-500 dark:text-gray-400">分数</p>
                          <p className="mt-1 text-lg font-bold">
                            {item.matchScore ?? '-'}
                          </p>
                        </div>

                        <div className="rounded border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                          <p className="text-gray-500 dark:text-gray-400">SKU</p>
                          <p className="mt-1 font-semibold">
                            {item.sku || '-'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 text-sm">
                        <p>
                          <span className="text-gray-500 dark:text-gray-400">
                            匹配：
                          </span>
                          {item.displayName ||
                            item.productNameCN ||
                            item.productNameEN ||
                            '-'}
                        </p>
                        <p>
                          <span className="text-gray-500 dark:text-gray-400">
                            原因：
                          </span>
                          {item.matchReason || '-'}
                        </p>
                        {item.secondChoice && (
                          <p>
                            <span className="text-gray-500 dark:text-gray-400">
                              第二候选：
                            </span>
                            {item.secondChoice.sku || '-'} /{' '}
                            {item.secondChoice.name || '-'} / 分数：
                            {item.secondChoice.score ?? '-'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">订单商品明细</h2>
                <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  总数：{totalPickQty}
                </span>
              </div>

              <div className="flex flex-col gap-2 [&>a]:w-full [&>button]:w-full sm:flex-row sm:flex-wrap sm:justify-end sm:[&>a]:w-auto sm:[&>button]:w-auto">
                {orderActions.canConfirm && (
                  <ConfirmOrderButton
                    orderId={order.id}
                    status={order.status}
                  />
                )}

                {orderActions.canOpenPicking && (
                  <NavButton
                    href={`/admin/picking?orderId=${encodeURIComponent(
                      order.id
                    )}#order-selector`}
                    variant="primary"
                  >
                    进入拣货列表
                  </NavButton>
                )}
              </div>
            </div>

            {itemsError && (
              <p className="mb-3 text-red-600 dark:text-red-400">
                读取商品明细失败：{itemsError.message}
              </p>
            )}

            {!items || items.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                这个订单还没有商品
              </p>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-800">
                <table className="w-full min-w-[980px] text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        品牌
                      </th>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        SKU
                      </th>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        品名
                      </th>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        识别数量
                      </th>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        拣货数量
                      </th>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        库位
                      </th>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        库存变化
                      </th>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        状态
                      </th>
                      <th className="whitespace-nowrap border-b border-gray-200 p-3 text-left dark:border-gray-700">
                        操作
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(items as OrderItem[]).map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/70"
                      >
                        <td className="whitespace-nowrap border-b border-gray-200 p-3 font-medium dark:border-gray-800">
                          {item.brand_snapshot || '-'}
                        </td>

                        <td className="whitespace-nowrap border-b border-gray-200 p-3 font-medium dark:border-gray-800">
                          {item.sku_snapshot || '-'}
                        </td>

                        <td className="border-b border-gray-200 p-3 dark:border-gray-800">
                          <div className="min-w-[150px]">
                            <div className="font-medium">
                              {item.product_name_cn_snapshot || '-'}
                            </div>

                            {item.product_name_en_snapshot && (
                              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                {item.product_name_en_snapshot}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                          {item.recognized_qty} {item.recognized_unit}
                        </td>

                        <td className="whitespace-nowrap border-b border-gray-200 p-3 font-medium dark:border-gray-800">
                          {item.pick_qty}
                        </td>

                        <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                          {item.shelf_location_snapshot || '需要确认'}
                        </td>

                        <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                          {item.before_qty ?? '-'} → {item.after_qty ?? '-'}
                        </td>

                        <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                          <span
                            className={`rounded px-2 py-1 ${getItemStatusClass(
                              item.match_status
                            )}`}
                          >
                            {getItemStatusLabel(item.match_status)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap border-b border-gray-200 p-3 dark:border-gray-800">
                          {orderActions.canEditItems ? (
                            <div className="flex items-center gap-2">
                              <EditOrderItemButton
                                itemId={item.id}
                                orderStatus={order.status}
                                currentQty={item.recognized_qty}
                                currentUnit={item.recognized_unit || '支'}
                              />

                              <DeleteOrderItemButton
                                itemId={item.id}
                                orderStatus={order.status}
                              />
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <section className="max-w-2xl">
            {productsError && (
              <p className="mb-3 text-red-600 dark:text-red-400">
                读取商品列表失败：{productsError.message}
              </p>
            )}

            {orderActions.canEditItems && (
              <AddOrderItemForm
                orderId={order.id}
                orderStatus={order.status}
                products={(products || []) as ProductWithInventory[]}
              />
            )}
          </section>
        </div>
    </PageShell>
  )
}

type OrderItem = {
  id: string
  sku_snapshot: string | null
  brand_snapshot: string | null
  product_name_cn_snapshot: string | null
  product_name_en_snapshot: string | null
  display_name_snapshot: string | null
  recognized_qty: number
  recognized_unit: string | null
  pick_qty: number
  shelf_location_snapshot: string | null
  before_qty: number | null
  after_qty: number | null
  match_status: string
  created_at: string | null
}
