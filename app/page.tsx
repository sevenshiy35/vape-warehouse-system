import Link from 'next/link'
import { PageHeader, PageShell, Panel } from '@/components/PageChrome'

const links = [
  {
    title: '提交新订单',
    description: '上传订单截图，填写地址和备注',
    href: '/submit-order',
    color:
      'bg-black text-white dark:bg-gray-100 dark:text-gray-900',
  },
  {
    title: '订单列表',
    description: '查看所有订单，添加商品，确认出库',
    href: '/admin/orders',
    color:
      'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
  },
{
  title: '拣货列表',
  description: '按库位汇总所有拣货中订单的商品',
  href: '/admin/picking',
  color: 'bg-orange-600 text-white dark:bg-orange-500 dark:text-white',
},
  {
    title: '库存列表',
    description: '查看所有商品库存、库位和低库存状态',
    href: '/admin/inventory',
    color:
      'bg-green-700 text-white dark:bg-green-500 dark:text-white',
  },
  {
    title: '添加新品',
    description: '创建新的 SKU，并设置初始库存和库位',
    href: '/admin/products/new',
    color:
      'bg-purple-600 text-white dark:bg-purple-500 dark:text-white',
  },
  {
    title: '入库',
    description: '给已有商品增加库存，写入入库流水',
    href: '/admin/inbound',
    color:
      'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
  },
  {
    title: '库存修正',
    description: '盘点时修正实际库存，自动写入流水',
    href: '/admin/correction',
    color:
      'bg-yellow-600 text-white dark:bg-yellow-400 dark:text-gray-950',
  },
  {
    title: '库位挪动',
    description: '调整商品库位，不改变库存数量',
    href: '/admin/location-move',
    color:
      'bg-purple-700 text-white dark:bg-purple-400 dark:text-gray-950',
  },
  {
    title: '库存流水',
    description: '查看出库、入库、盘点修正、库位挪动记录',
    href: '/admin/logs',
    color:
      'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-950',
  },
]

export default function HomePage() {
  return (
    <PageShell maxWidth="max-w-5xl">
      <PageHeader
        title="电子烟仓库管理系统"
        description="订单上传、库存管理、出库确认、入库、库存修正、库位挪动和库存流水入口"
        eyebrow="Warehouse"
      />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="
                rounded-lg border border-gray-200 bg-white p-5 shadow-sm
                transition hover:-translate-y-1 hover:shadow-md
                dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/80
              "
            >
              <div
                className={`mb-4 inline-flex rounded-lg px-3 py-2 text-sm font-medium ${item.color}`}
              >
                {item.title}
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.description}
              </p>

              <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                {item.href}
              </p>
            </Link>
          ))}
        </div>

        <Panel className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">日常使用流程</h2>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>进入“提交新订单”，上传订单截图，填写地址和备注。</li>
            <li>进入“订单列表”，点开刚创建的订单。</li>
            <li>在订单详情页手动添加商品，检查数量、库位和库存变化。</li>
            <li>确认无误后点击“确认出库”。</li>
            <li>出库后可以在“库存列表”和“库存流水”检查结果。</li>
            <li>收到新货时进入“入库”；盘点错误时进入“库存修正”。</li>
            <li>只调整货架位置时进入“库位挪动”。</li>
          </ol>
        </Panel>
    </PageShell>
  )
}
