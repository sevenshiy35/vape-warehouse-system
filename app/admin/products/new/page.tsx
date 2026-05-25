import Link from 'next/link'
import NewProductForm from '@/components/NewProductForm'

export const dynamic = 'force-dynamic'

export default function NewProductPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-5xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">添加新品库存</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              创建新的 SKU，并设置初始库存和库位。
            </p>
          </div>

          <div className="flex gap-4">
            <Link
              href="/admin/inventory"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              库存列表
            </Link>

            <Link
              href="/admin/inbound"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              入库
            </Link>
          </div>
        </div>

        <NewProductForm />
      </div>
    </main>
  )
}