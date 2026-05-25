import NewProductForm from '@/components/NewProductForm'
import { NavButton, PageHeader, PageShell } from '@/components/PageChrome'

export const dynamic = 'force-dynamic'

export default function NewProductPage() {
  return (
    <PageShell maxWidth="max-w-5xl">
      <PageHeader
        title="添加新品库存"
        description="创建新的 SKU，并设置初始库存和库位。"
        actions={
          <>
            <NavButton href="/admin/inventory">库存列表</NavButton>
            <NavButton href="/admin/inbound" variant="primary">
              入库
            </NavButton>
          </>
        }
      />

        <NewProductForm />
    </PageShell>
  )
}
