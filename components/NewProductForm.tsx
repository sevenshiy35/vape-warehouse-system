'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedback } from '@/components/FeedbackProvider'

type Props = {
  brandOptions?: string[]
}

export default function NewProductForm({ brandOptions = [] }: Props) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()

  const [sku, setSku] = useState('')
  const [brand, setBrand] = useState('')
  const [productNameCN, setProductNameCN] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [productNameEN, setProductNameEN] = useState('')
  const [initialQty, setInitialQty] = useState(0)
  const [shelfLocation, setShelfLocation] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState(3)
  const [operator, setOperator] = useState('admin')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!brand.trim()) {
      notify({ type: 'warning', title: '请选择或输入品牌' })
      return
    }

    if (!productNameCN.trim()) {
      notify({ type: 'warning', title: '请输入中文库存品名' })
      return
    }

    if (!Number.isInteger(initialQty) || initialQty < 0) {
      notify({ type: 'warning', title: '初始库存必须是 0 或更大的整数' })
      return
    }

    if (initialQty > 0 && !shelfLocation.trim()) {
      notify({ type: 'warning', title: '初始库存大于 0 时，必须填写库位' })
      return
    }

    const ok = await confirm({
      title: '确认添加新品？',
      message: `SKU：${sku.trim() || '系统自动生成'}\n品牌：${brand}\n中文名：${productNameCN}\n初始库存：${initialQty}`,
      confirmText: '添加新品',
      tone: 'success',
    })

    if (!ok) return

    setLoading(true)

    const res = await fetch('/api/products/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sku,
        brand,
        productNameCN,
        displayName,
        productNameEN,
        initialQty,
        shelfLocation,
        lowStockThreshold,
        operator,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      notify({
        type: 'error',
        title: '添加新品失败',
        message: data.error,
      })
      return
    }

    notify({ type: 'success', title: '新品添加成功' })

    setSku('')
    setBrand('')
    setProductNameCN('')
    setDisplayName('')
    setProductNameEN('')
    setInitialQty(0)
    setShelfLocation('')
    setLowStockThreshold(3)

    router.push('/admin/inventory')
    router.refresh()
  }

  return (
    <form
  onSubmit={handleSubmit}
  className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
>
      <h2 className="text-lg font-semibold">添加新品库存</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            SKU，可选
          </label>
          <input
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="不填则自动生成，例如 SP 最大为 SP-33 时生成 SP-34"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            品牌 <span className="text-red-500">*</span>
          </label>
          <input
            list="brand-options"
            className="w-full rounded border px-3 py-2"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="选择或输入品牌"
          />

          <datalist id="brand-options">
            {brandOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            中文库存品名 <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full rounded border px-3 py-2"
            value={productNameCN}
            onChange={(e) => setProductNameCN(e.target.value)}
            placeholder="例如 椰子水 / 青提"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            展示品名，可选
          </label>
          <input
            className="w-full rounded border px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例如 SP 椰子水"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            英文名，可选
          </label>
          <input
            className="w-full rounded border px-3 py-2"
            value={productNameEN}
            onChange={(e) => setProductNameEN(e.target.value)}
            placeholder="例如 Coconut Water"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            初始库存
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded border px-3 py-2"
            value={initialQty}
            onChange={(e) => setInitialQty(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            库位
          </label>
          <input
            className="w-full rounded border px-3 py-2"
            value={shelfLocation}
            onChange={(e) => setShelfLocation(e.target.value)}
            placeholder="初始库存大于 0 时必须填写"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            低库存提醒阈值
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded border px-3 py-2"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            操作人
          </label>
          <input
            className="w-full rounded border px-3 py-2"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder="例如 admin / Seven"
          />
        </div>
      </div>

      <div className="rounded bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <p>规则：</p>
        <p>1. SKU 不能重复。</p>
        <p>2. 初始库存大于 0 时必须填写库位。</p>
        <p>3. 初始库存为 0 时，系统会自动清空库位。</p>
        <p>4. 初始库存大于 0 时，会自动写入一条 Inbound 库存流水。</p>
      </div>

      <div className="flex gap-3">
        <button
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? '添加中...' : '添加新品'}
        </button>

        <button
  type="button"
  onClick={() => router.push('/admin/inventory')}
  className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
>
  返回库存列表
</button>
      </div>
    </form>
  )
}
