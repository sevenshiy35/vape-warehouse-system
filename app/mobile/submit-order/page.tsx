import Link from 'next/link'

export default function MobileSubmitOrderPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-5 text-gray-950">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="space-y-3 border-b border-gray-200 pb-4">
          <Link href="/mobile/orders" className="text-sm text-blue-700">
            返回手机端订单
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">
              Mobile
            </p>
            <h1 className="text-2xl font-bold">提交新订单</h1>
          </div>
        </header>

        <form
          action="/api/orders/create"
          method="post"
          encType="multipart/form-data"
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="returnTo" value="mobile" />

          <div>
            <label className="mb-1 block text-sm font-medium">订单截图</label>
            <input
              type="file"
              name="images"
              accept="image/*"
              multiple
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-white"
            />
            <p className="mt-2 text-xs text-gray-500">
              这是手机端原生提交页面，不依赖弹窗和前端按钮脚本。
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">客户名</label>
            <input
              name="customerName"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="可选"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">地址</label>
            <textarea
              name="address"
              required
              className="min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="例如：615 Pavonia Avenue, Unit #4406"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">备注</label>
            <textarea
              name="note"
              className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="门禁、到店备注、特殊说明"
            />
          </div>

          <button className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-black px-4 py-3 font-semibold text-white">
            提交订单
          </button>
        </form>
      </div>
    </main>
  )
}
