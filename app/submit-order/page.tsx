'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getErrorMessage } from '@/lib/errors'
import {
  NavButton,
  PageHeader,
  PageShell,
  Panel,
} from '@/components/PageChrome'
import { useFeedback } from '@/components/FeedbackProvider'

type CreatedOrder = {
  id: string
  order_no: string
  address: string | null
  note: string | null
  status: string
  image_path: string | null
  image_paths?: string[] | null
}

type ImagePreview = {
  key: string
  file: File
  url: string
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

export default function SubmitOrderPage() {
  const router = useRouter()
  const { notify } = useFeedback()
  const fileInputId = useId()
  const formRef = useRef<HTMLFormElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewUrlsRef = useRef<string[]>([])

  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<ImagePreview[]>([])
  const [customerName, setCustomerName] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 md:text-sm'

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function updateImages(nextImages: File[]) {
    for (const url of previewUrlsRef.current) {
      URL.revokeObjectURL(url)
    }

    const nextPreviews = nextImages.map((file) => ({
      key: getFileKey(file),
      file,
      url: URL.createObjectURL(file),
    }))

    previewUrlsRef.current = nextPreviews.map((preview) => preview.url)
    setImages(nextImages)
    setPreviews(nextPreviews)

    if (nextImages.length === 0) {
      clearFileInput()
    }
  }

  function clearForm() {
    formRef.current?.reset()
    updateImages([])
    setCustomerName('')
    setAddress('')
    setNote('')
  }

  function handleFilesChange(files: FileList | null) {
    const selectedFiles = Array.from(files || [])
    updateImages(selectedFiles)
    setError('')
  }

  function removeImage(key: string) {
    updateImages(images.filter((image) => getFileKey(image) !== key))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setCreatedOrder(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    const selectedImages = formData
      .getAll('images')
      .filter((value): value is File => value instanceof File && value.size > 0)
    const nextCustomerName = String(formData.get('customerName') || '').trim()
    const nextAddress = String(formData.get('address') || '').trim()
    const nextNote = String(formData.get('note') || '').trim()

    if (selectedImages.length === 0) {
      setError('请至少上传一张订单截图')
      notify({
        type: 'warning',
        title: '缺少订单截图',
        message: '请先选择至少一张图片再提交。',
      })
      return
    }

    if (!nextAddress) {
      setError('请填写地址')
      notify({
        type: 'warning',
        title: '缺少地址',
        message: '地址是创建订单所必需的信息。',
      })
      return
    }

    setLoading(true)

    try {
      const submitData = new FormData()

      for (const image of selectedImages) {
        submitData.append('images', image)
      }

      submitData.append('customerName', nextCustomerName)
      submitData.append('address', nextAddress)
      submitData.append('note', nextNote)

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: submitData,
      })

      const data = await res.json()

      if (!res.ok) {
        const message = data.error || '上传订单失败'
        setError(message)
        notify({
          type: 'error',
          title: '订单提交失败',
          message,
        })
        return
      }

      setCreatedOrder(data.order)
      clearForm()
      notify({
        type: 'success',
        title: '订单创建成功',
        message: `OrderID：${data.order.order_no}`,
      })
      router.refresh()
    } catch (err: unknown) {
      const message = getErrorMessage(err, '上传订单失败')
      setError(message)
      notify({
        type: 'error',
        title: '订单提交失败',
        message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell maxWidth="max-w-4xl">
      <PageHeader
        title="提交新订单"
        description="上传一张或多张订单截图，填写地址和备注。提交成功后会自动生成 OrderID。"
        actions={
          <>
            <NavButton href="/">首页</NavButton>
            <NavButton href="/admin/orders" variant="primary">
              订单列表
            </NavButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <Panel>
          <form
            ref={formRef}
            action="/api/orders/create"
            method="post"
            encType="multipart/form-data"
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                订单截图
              </label>

              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950">
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  name="images"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFilesChange(e.target.files)}
                  onInput={(e) => handleFilesChange(e.currentTarget.files)}
                  className="sr-only"
                />

                <label
                  htmlFor={fileInputId}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-lg bg-black px-4 py-3 text-base font-semibold text-white active:scale-[0.99] dark:bg-gray-100 dark:text-gray-900"
                >
                  选择订单截图
                </label>

                <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                  可以拍照或从相册选择，多张截图可一次选择。
                </p>
              </div>

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                支持一单多张截图。选错图片时，可以在下方单独删除，不用重新选择全部文件。
              </p>

              {previews.length > 0 && (
                <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium">
                      已选择 {previews.length} 张图片
                    </p>

                    <button
                      type="button"
                      onClick={() => updateImages([])}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      清空图片
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {previews.map((preview, index) => (
                      <div
                        key={preview.key}
                        className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                      >
                        <div
                          className="aspect-[4/3] bg-cover bg-center"
                          style={{ backgroundImage: `url(${preview.url})` }}
                          aria-label={`订单截图 ${index + 1}`}
                        />

                        <div className="space-y-2 p-3">
                          <div>
                            <p className="truncate text-sm font-medium">
                              {index + 1}. {preview.file.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(preview.file.size)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeImage(preview.key)}
                            className="inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950"
                          >
                            删除这张
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                客户名
              </label>

              <input
                name="customerName"
                className={inputClass}
                defaultValue={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onInput={(e) => setCustomerName(e.currentTarget.value)}
                placeholder="可选"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                地址
              </label>

              <textarea
                name="address"
                className={`${inputClass} min-h-28`}
                defaultValue={address}
                onChange={(e) => setAddress(e.target.value)}
                onInput={(e) => setAddress(e.currentTarget.value)}
                placeholder="例如：615 Pavonia Avenue, Unit #4406"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                备注
              </label>

              <textarea
                name="note"
                className={`${inputClass} min-h-24`}
                defaultValue={note}
                onChange={(e) => setNote(e.target.value)}
                onInput={(e) => setNote(e.currentTarget.value)}
                placeholder="例如：门禁、到店备注、特殊说明"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 sm:w-auto"
              >
                {loading ? '上传中...' : '提交订单'}
              </button>

              <button
                type="button"
                onClick={clearForm}
                disabled={loading}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 sm:w-auto"
              >
                清空表单
              </button>
            </div>
          </form>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <h2 className="text-base font-semibold">提交前核对</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-gray-500 dark:text-gray-400">截图</p>
                <p className="mt-1 text-xl font-bold">{images.length}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-gray-500 dark:text-gray-400">地址状态</p>
                <p className="mt-1 font-semibold">
                  {address.trim() ? '已填写' : '待填写'}
                </p>
              </div>
            </div>
          </Panel>

          {createdOrder && (
            <Panel className="border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30">
              <h2 className="text-lg font-semibold text-green-800 dark:text-green-300">
                订单创建成功
              </h2>

              <div className="mt-3 space-y-2 text-sm text-green-800 dark:text-green-200">
                <p>
                  <span className="font-medium">OrderID：</span>
                  {createdOrder.order_no}
                </p>

                <p>
                  <span className="font-medium">截图数量：</span>
                  {createdOrder.image_paths?.length || 1}
                </p>

                <p>
                  <span className="font-medium">地址：</span>
                  {createdOrder.address || '-'}
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <Link
                  href={`/admin/orders/${createdOrder.id}`}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500"
                >
                  查看订单详情
                </Link>

                <Link
                  href="/admin/orders"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
                >
                  返回订单列表
                </Link>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </PageShell>
  )
}
