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
    description: '查看订单、识别商品、确认订单并进入拣货',
    href: '/admin/orders',
    color:
      'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
  },
{
  title: '拣货列表',
  description: '按单号拣货、核对商品并完成订单',
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
        description="订单上传、商品识别、库存预扣、拣货完成、入库、盘点修正和库存流水入口"
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
            <li>进入“订单列表”，打开刚创建的订单详情。</li>
            <li>在订单详情页使用 AI 识别或手动添加商品，核对 SKU、数量、单位、库位和拣货数量。</li>
            <li>商品核对无误后点击“确认订单”，系统会预扣库存，并把订单转入“拣货中”。</li>
            <li>进入“拣货列表”，按单号和库位拣货、打包。</li>
            <li>拣货中如需改商品，在订单详情页修改；订单会进入“拣货修改中”，确认后点击“保存修改”。</li>
            <li>拣货完成后点击“完成拣货”，订单状态变为“已完成”。</li>
            <li>取消已预扣库存的订单时，系统会自动退回已预扣数量；普通未确认订单取消不会影响库存。</li>
            <li>收到新货进入“入库”；盘点数量不符进入“库存修正”；只调整货架位置进入“库位挪动”。</li>
            <li>需要复查库存变化时，进入“库存流水”查看入库、预扣、退回、盘点和库位记录。</li>
          </ol>
        </Panel>
    </PageShell>
  )
}
