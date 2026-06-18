import Image from 'next/image'
import Link from 'next/link'
import { NavButton, PageShell, Panel } from '@/components/PageChrome'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatEasternTime } from '@/lib/time'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

type WorkOrder = {
  id: string
  order_no: string
  address: string | null
  status: string
  total_items: number | null
  created_at: string | null
}

type RecentLog = {
  id: string
  sku_snapshot: string | null
  product_name_snapshot: string | null
  change_qty: number | null
  log_type: string | null
  created_at: string | null
}

const quickActions = [
  {
    title: '入库',
    icon: '入',
    description: '已有 SKU 到货补库存',
    href: '/admin/inbound',
    tone: 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950',
  },
  {
    title: '添加新品',
    icon: '添',
    description: '创建新 SKU 和初始库位',
    href: '/admin/products/new',
    tone: 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950',
  },
  {
    title: '库存修正',
    icon: '修',
    description: '盘点后修正实际数量',
    href: '/admin/correction',
    tone: 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950',
  },
  {
    title: '库位挪动',
    icon: '挪',
    description: '只调整货架位置',
    href: '/admin/location-move',
    tone: 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950',
  },
]

const vapeIconTiles = [
  {
    src: '/icons/batch/green-plum-tea-128.png',
    motionClass: styles.vapeIconFloat,
  },
  {
    src: '/icons/batch/spring-blossom-128.png',
    motionClass: styles.vapeIconTilt,
  },
  {
    src: '/icons/batch/peach-128.png',
    motionClass: styles.vapeIconPulse,
  },
  {
    src: '/icons/batch/apple-128.png',
    motionClass: styles.vapeIconFloat,
  },
  {
    src: '/icons/batch/bubblemon-128.png',
    motionClass: styles.vapeIconHop,
  },
  {
    src: '/icons/batch/lychee-128.png',
    motionClass: styles.vapeIconTilt,
  },
  {
    src: '/icons/batch/rose-gold-128.png',
    motionClass: styles.vapeIconPulse,
  },
  {
    src: '/icons/batch/pineapple-lemonade-128.png',
    motionClass: styles.vapeIconTilt,
  },
]

const orderStatusMeta: Record<
  string,
  {
    label: string
    className: string
  }
> = {
  uploaded: {
    label: '已上传',
    className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900',
  },
  need_review: {
    label: '待确认',
    className:
      'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900',
  },
  picking: {
    label: '拣货中',
    className:
      'bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-950/40 dark:text-green-200 dark:ring-green-900',
  },
  picking_editing: {
    label: '修改中',
    className:
      'bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:ring-purple-900',
  },
}

const logTypeLabel: Record<string, string> = {
  Order: '订单出库',
  Inbound: '入库',
  Correction: '盘点修正',
  OrderReversal: '订单退回',
  LocationMove: '库位挪动',
}

function getOrderStatus(status: string) {
  return (
    orderStatusMeta[status] || {
      label: status,
      className:
        'bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700',
    }
  )
}

function getLogChange(value: number | null) {
  const change = Number(value || 0)
  return change > 0 ? `+${change}` : String(change)
}

export default async function HomePage() {
  const [
    needReviewResult,
    pickingResult,
    workOrdersResult,
    recentLogsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'need_review'),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['picking', 'picking_editing']),
    supabaseAdmin
      .from('orders')
      .select('id, order_no, address, status, total_items, created_at')
      .in('status', ['uploaded', 'need_review', 'picking', 'picking_editing'])
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin
      .from('inventory_logs')
      .select('id, sku_snapshot, product_name_snapshot, change_qty, log_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const workOrders = (workOrdersResult.data || []) as WorkOrder[]
  const recentLogs = (recentLogsResult.data || []) as RecentLog[]

  return (
    <PageShell maxWidth="max-w-7xl">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-white shadow-sm shadow-zinc-200/80 dark:bg-[var(--surface)] dark:shadow-none">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 md:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Warehouse Daily Board
              </p>

              <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50 md:text-6xl">
                电子烟仓库作业台
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)] md:text-lg">
                先处理待确认订单，再按库位拣货；库存异常和最近流水放在同一屏，减少来回跳转。
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <NavButton href="/submit-order" variant="primary">
                  提交新订单
                </NavButton>
                <NavButton href="/admin/orders" variant="warning">
                  查看订单
                </NavButton>
                <NavButton href="/admin/picking" variant="success">
                  进入拣货
                </NavButton>
                <NavButton href="/admin/inventory">库存列表</NavButton>
                <NavButton href="/admin/logs" variant="quiet">
                  库存流水
                </NavButton>
              </div>
            </div>

            <div className="border-t border-[var(--border-soft)] bg-[var(--surface-soft)] p-5 dark:bg-zinc-950/30 lg:border-l lg:border-t-0 md:p-7">
              <div className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm shadow-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-none">
                今日先看这里
              </div>

              <Link
                href="/submit-order"
                className="mt-5 block rounded-3xl border border-blue-200 bg-white p-5 shadow-sm shadow-blue-100/70 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-blue-900 dark:bg-zinc-900 dark:shadow-none dark:hover:border-blue-700"
              >
                <p className="text-sm font-semibold text-[var(--primary)]">
                  新订单入口
                </p>
                <p className="mt-1 text-3xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                  提交新订单
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  上传订单截图，填写地址和备注，开始 AI 识别流程。
                </p>
                <span className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white">
                  开始上传
                </span>
              </Link>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-900 dark:bg-orange-950/30">
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-200">
                    待确认
                  </p>
                  <p className="mt-1 text-4xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                    {needReviewResult.count || 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-green-200 bg-green-50/80 p-4 dark:border-green-900 dark:bg-green-950/30">
                  <p className="text-sm font-medium text-green-700 dark:text-green-200">
                    拣货中
                  </p>
                  <p className="mt-1 text-4xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                    {pickingResult.count || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.vapeIconStrip} aria-label="电子烟图标动画">
          {vapeIconTiles.map((icon) => (
            <div className={styles.vapeIconTile} key={icon.src}>
              <Image
                className={`${styles.vapeIcon} ${icon.motionClass}`}
                src={icon.src}
                alt=""
                width={128}
                height={128}
                loading="eager"
              />
              <span className={styles.vapeIconShadow} />
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Current Work
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                  当前作业队列
                </h2>
              </div>

              <NavButton href="/admin/orders" variant="warning">
                查看全部订单
              </NavButton>
            </div>

            {workOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-[var(--surface-soft)] p-6 text-sm text-[var(--muted)] dark:border-zinc-700">
                暂时没有待处理订单，作业台很清爽。
              </div>
            ) : (
              <div className="space-y-3">
                {workOrders.map((order) => {
                  const status = getOrderStatus(order.status)

                  return (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="block rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] p-4 transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-orange-800 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-bold tracking-[-0.02em] text-orange-600 dark:text-orange-300">
                            {order.order_no}
                          </p>
                          <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-300">
                            {order.address || '地址未填写'}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                        <span>商品数：{order.total_items ?? '-'}</span>
                        <span>{formatEasternTime(order.created_at)}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Quick Actions
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                  快速操作
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] p-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
                  >
                    <span
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm ${action.tone}`}
                    >
                      {action.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-zinc-950 dark:text-zinc-50">
                        {action.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-[var(--muted)]">
                        {action.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Recent Logs
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                    最近库存流水
                  </h2>
                </div>
                <Link
                  href="/admin/logs"
                  className="text-sm font-semibold text-[var(--primary)] hover:underline"
                >
                  全部
                </Link>
              </div>

              {recentLogs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-300 bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)] dark:border-zinc-700">
                  暂无库存流水。
                </p>
              ) : (
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-50">
                            {log.sku_snapshot || '-'}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                            {log.product_name_snapshot || '-'}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 text-sm font-black ${
                            Number(log.change_qty || 0) < 0
                              ? 'text-red-600 dark:text-red-300'
                              : 'text-green-600 dark:text-green-300'
                          }`}
                        >
                          {getLogChange(log.change_qty)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <span>{logTypeLabel[String(log.log_type || '')] || log.log_type || '-'}</span>
                        <span>{formatEasternTime(log.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
