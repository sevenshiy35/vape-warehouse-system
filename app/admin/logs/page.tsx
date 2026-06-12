import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NavButton, PageHeader, PageShell, Panel } from '@/components/PageChrome'
import InventoryLogsTable, {
  type InventoryLogRow,
} from '@/components/InventoryLogsTable'

export const dynamic = 'force-dynamic'

export default async function AdminLogsPage() {
  const { data: logs, error } = await supabaseAdmin
    .from('inventory_logs')
    .select(`
      id,
      sku_snapshot,
      product_name_snapshot,
      change_qty,
      before_qty,
      after_qty,
      log_type,
      reason,
      operator,
      created_at,
      old_shelf_location,
      new_shelf_location,
      orders (
        order_no
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <PageShell>
        <PageHeader title="库存流水" />
        <p className="text-red-600 dark:text-red-400">
          读取库存流水失败：{error.message}
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="库存流水"
        description="查看所有出库、入库、盘点修正、库位挪动记录"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/orders">订单列表</NavButton>
            <NavButton href="/admin/inventory" variant="primary">
              库存列表
            </NavButton>
            <NavButton href="/admin/inbound">入库</NavButton>
            <NavButton href="/admin/correction">库存修正</NavButton>
            <NavButton href="/admin/location-move">库位挪动</NavButton>
          </>
        }
      />

      {!logs || logs.length === 0 ? (
        <Panel className="text-gray-500 dark:text-gray-400">
          暂无库存流水
        </Panel>
      ) : (
        <InventoryLogsTable logs={logs as InventoryLogRow[]} />
      )}
    </PageShell>
  )
}
