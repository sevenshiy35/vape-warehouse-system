import { supabaseAdmin } from '@/lib/supabaseAdmin'
import OrdersTable from '@/components/OrdersTable'
import { NavButton, PageHeader, PageShell } from '@/components/PageChrome'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    q?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    sort?: string
    dir?: string
  }>
}

const validStatuses = new Set([
  'uploaded',
  'need_review',
  'picking',
  'picking_editing',
  'completed',
  'cancelled',
])

const validSortKeys = new Set([
  'order_no',
  'address',
  'note',
  'status',
  'total_items',
  'created_at',
])

type OrdersTableOrders = Parameters<typeof OrdersTable>[0]['orders']

function cleanSearchText(value: string) {
  return value.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {}

  const q = String(sp.q || '').trim()
  const status = String(sp.status || '全部')
  const dateFrom = String(sp.dateFrom || '')
  const dateTo = String(sp.dateTo || '')
  const sort = validSortKeys.has(String(sp.sort))
    ? String(sp.sort)
    : 'created_at'
  const dir = sp.dir === 'asc' ? 'asc' : 'desc'

  let query = supabaseAdmin
    .from('orders')
    .select(
      'id, order_no, address, note, status, image_path, image_paths, total_items, created_at'
    )

  if (status !== '全部' && validStatuses.has(status)) {
    query = query.eq('status', status)
  }

  if (dateFrom) {
    query = query.gte('created_at', `${dateFrom}T00:00:00`)
  }

  if (dateTo) {
    query = query.lte('created_at', `${dateTo}T23:59:59`)
  }

  if (q) {
    const safeQ = cleanSearchText(q)

    if (safeQ) {
      query = query.or(
        `order_no.ilike.%${safeQ}%,address.ilike.%${safeQ}%,note.ilike.%${safeQ}%`
      )
    }
  }

  const { data: orders, error } = await query.order(sort, {
    ascending: dir === 'asc',
  })

  if (error) {
    return (
      <PageShell>
        <PageHeader title="订单列表" />
        <p className="text-red-600 dark:text-red-400">
          读取订单失败：{error.message}
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="订单列表"
        description="查看所有订单，点 OrderID 可进入订单详情。"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/submit-order" variant="primary">
              提交新订单
            </NavButton>
            <NavButton href="/admin/picking">拣货列表</NavButton>
            <NavButton href="/admin/inventory">库存列表</NavButton>
            <NavButton href="/admin/logs">库存流水</NavButton>
          </>
        }
      />

        <OrdersTable
          orders={(orders || []) as OrdersTableOrders}
          filters={{
            q,
            status,
            dateFrom,
            dateTo,
            sort,
            dir,
          }}
        />
    </PageShell>
  )
}
