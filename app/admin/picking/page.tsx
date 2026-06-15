import { supabaseAdmin } from '@/lib/supabaseAdmin'
import PickingListClient, {
  type PickingOrder,
} from '@/components/PickingListClient'
import {
  NavButton,
  PageHeader,
  PageShell,
  StatCard,
} from '@/components/PageChrome'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    orderId?: string
  }>
}

export default async function PickingPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {}
  const orderIdParam = typeof sp.orderId === 'string' ? sp.orderId : ''

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_no,
      address,
      note,
      status,
      created_at,
      order_items (
        id,
        sku_snapshot,
        brand_snapshot,
        product_name_cn_snapshot,
        product_name_en_snapshot,
        display_name_snapshot,
        pick_qty,
        shelf_location_snapshot
      )
    `)
    .in('status', ['picking', 'picking_editing'])
    .order('created_at', { ascending: true })

  if (error) {
    return (
      <PageShell>
        <PageHeader title="拣货列表" />
        <p className="text-red-600 dark:text-red-400">
          读取拣货订单失败：{error.message}
        </p>
      </PageShell>
    )
  }

  const safeOrders = (orders || []) as PickingOrder[]

  const selectedOrderId = safeOrders.some((order) => order.id === orderIdParam)
    ? orderIdParam
    : safeOrders[0]?.id || ''

  return (
    <PageShell>
      <PageHeader
        title="拣货列表"
        description="按单号选择订单，一单一单拣货和打包。"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/orders" variant="warning">
              订单列表
            </NavButton>
            <NavButton href="/admin/inventory">库存列表</NavButton>
            <NavButton href="/admin/logs">库存流水</NavButton>
          </>
        }
      />

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label="拣货中订单" value={safeOrders.length} />
          <StatCard label="拣货方式" value="按单号拣货" />
          <StatCard label="排序方式" value="按库位顺序" />
        </div>

        <PickingListClient
          orders={safeOrders}
          selectedOrderId={selectedOrderId}
        />
    </PageShell>
  )
}
