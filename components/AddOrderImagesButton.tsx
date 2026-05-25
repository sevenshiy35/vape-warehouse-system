'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  orderId: string
  status: string
}

export default function AddOrderImagesButton({ orderId, status }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const disabled =
    loading || status === 'completed' || status === 'cancelled'

  function clearFiles() {
    setImages([])
    setError('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleUpload() {
    setError('')

    if (status === 'completed') {
      setError('已完成订单不建议补传截图')
      return
    }

    if (status === 'cancelled') {
      setError('已取消订单不能补传截图')
      return
    }

    if (images.length === 0) {
      setError('请至少选择一张图片')
      return
    }

    setLoading(true)

    const formData = new FormData()
    formData.append('orderId', orderId)

    for (const image of images) {
      formData.append('images', image)
    }

    const res = await fetch('/api/orders/upload-images', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || '补传截图失败')
      return
    }

    clearFiles()
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        补传截图
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/70">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">补传订单截图</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  补传后会加入当前订单，AI识别时会一起读取。
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  clearFiles()
                  setOpen(false)
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                关闭
              </button>
            </div>

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

            {error && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  clearFiles()
                  setOpen(false)
                }}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                取消
              </button>

              <button
                type="button"
                onClick={handleUpload}
                disabled={loading || images.length === 0}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                {loading ? '上传中...' : '上传截图'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}