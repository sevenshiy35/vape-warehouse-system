'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type CreatedOrder = {
  id: string
  order_no: string
  address: string | null
  note: string | null
  status: string
  image_path: string | null
  image_paths?: string[] | null
}

export default function SubmitOrderPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [images, setImages] = useState<File[]>([])
  const [customerName, setCustomerName] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [error, setError] = useState('')

  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'

  const navButtonClass =
    'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 md:px-5 md:py-2.5 md:text-base'

  function clearForm() {
    setImages([])
    setCustomerName('')
    setAddress('')
    setNote('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setCreatedOrder(null)

    if (images.length === 0) {
      setError('请至少上传一张订单截图')
      return
    }

    if (!address.trim()) {
      setError('请填写地址')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()

      for (const image of images) {
        formData.append('images', image)
      }

      formData.append('customerName', customerName.trim())
      formData.append('address', address.trim())
      formData.append('note', note.trim())

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '上传订单失败')
        setLoading(false)
        return
      }

      setCreatedOrder(data.order)
      clearForm()
      router.refresh()
    } catch (err: any) {
      setError(err.message || '上传订单失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">提交新订单</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              上传一张或多张订单截图，填写地址和备注。提交成功后会自动生成 OrderID。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/" className={navButtonClass}>
              首页
            </Link>

            <Link href="/admin/orders" className={navButtonClass}>
              订单列表
            </Link>
          </div>
        </div>

        <section className="rounded border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                订单截图
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files || [])
                  setImages(selectedFiles)
                }}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 file:mr-4 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-white dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:file:bg-gray-100 dark:file:text-gray-900"
              />

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                支持一单多张截图。比如商品截图一张、补充截图一张，仍然只生成一个 OrderID。
              </p>

              {images.length > 0 && (
                <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <p className="mb-2 text-sm font-medium">
                    已选择 {images.length} 张图片：
                  </p>

                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {images.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="break-all">
                        {index + 1}. {file.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                客户名
              </label>

              <input
                className={inputClass}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="可选"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                地址
              </label>

              <textarea
                className={`${inputClass} min-h-24`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="例如：615 Pavonia Avenue, Unit #4406"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                备注
              </label>

              <textarea
                className={`${inputClass} min-h-20`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：门禁、到店备注、特殊说明"
              />
            </div>

            {error && (
              <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-black px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 md:w-auto"
            >
              {loading ? '上传中...' : '提交订单'}
            </button>
          </form>
        </section>

        {createdOrder && (
          <section className="mt-6 rounded border border-green-200 bg-green-50 p-5 dark:border-green-900/50 dark:bg-green-950/30">
            <h2 className="mb-3 text-lg font-semibold text-green-800 dark:text-green-300">
              订单创建成功
            </h2>

            <div className="space-y-2 text-sm text-green-800 dark:text-green-200">
              <p>
                <span className="font-medium">OrderID：</span>
                {createdOrder.order_no}
              </p>

              <p>
                <span className="font-medium">状态：</span>
                {createdOrder.status}
              </p>

              <p>
                <span className="font-medium">截图数量：</span>
                {createdOrder.image_paths?.length || 1}
              </p>

              <p>
                <span className="font-medium">地址：</span>
                {createdOrder.address || '-'}
              </p>

              {createdOrder.note && (
                <p>
                  <span className="font-medium">备注：</span>
                  {createdOrder.note}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/admin/orders/${createdOrder.id}`}
                className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500"
              >
                查看订单详情
              </Link>

              <Link
                href="/admin/orders"
                className="rounded border border-green-300 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
              >
                返回订单列表
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}