import Image from 'next/image'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getInventoryRecord, type ProductWithInventory } from '@/lib/types'
import {
  addMobileOrderItem,
  cancelMobileOrder,
  completeMobilePicking,
  confirmMobileOrder,
  deleteMobileOrderItem,
  saveMobilePickingEdit,
  updateMobileOrderInfo,
  updateMobileOrderItem,
  uploadMobileOrderImages,
} from './actions'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
  searchParams?: Promise<{
    error?: string
    success?: string
  }>
}

type OrderItem = {
  id: string
  sku_snapshot: string | null
  brand_snapshot: string | null
  product_name_cn_snapshot: string | null
  product_name_en_snapshot: string | null
  display_name_snapshot: string | null
  recognized_qty: number
  recognized_unit: string | null
  pick_qty: number
  shelf_location_snapshot: string | null
  before_qty: number | null
  after_qty: number | null
  match_status: string
  created_at: string | null
}

function getOrderStatusLabel(status: string) {
  if (status === 'uploaded') return '已上传'
  if (status === 'need_review') return '待确认'
  if (status === 'picking') return '拣货中'
  if (status === 'picking_editing') return '拣货修改中'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return status
}

function getOrderStatusClass(status: string) {
  if (status === 'completed') return 'bg-green-100 text-green-800'
  if (status === 'cancelled') return 'bg-red-100 text-red-800'
  if (status === 'picking') return 'bg-orange-100 text-orange-800'
  if (status === 'picking_editing') return 'bg-purple-100 text-purple-800'
  if (status === 'need_review') return 'bg-yellow-100 text-yellow-800'
  return 'bg-blue-100 text-blue-800'
}

function getItemStatusLabel(status: string) {
  if (status === 'matched') return '已匹配'
  if (status === 'out_of_stock') return '库存不足'
  if (status === 'need_review') return '需确认'
  if (status === 'not_found') return '未匹配'
  return status
}

function getItemStatusClass(status: string) {
  if (status === 'matched') return 'bg-green-100 text-green-800'
  if (status === 'out_of_stock') return 'bg-red-100 text-red-800'
  if (status === 'need_review') return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-700'
}

function getProductLabel(product: ProductWithInventory) {
  const inv = getInventoryRecord(product)
  const name =
    product.display_name ||
    product.product_name_cn ||
    product.product_name_en ||
    product.sku

  return `${product.brand || '-'} | ${product.sku} | ${name} | 库存 ${
    inv?.quantity_on_hand ?? 0
  } | ${inv?.shelf_location || '无库位'}`
}

function Button({
  children,
  tone = 'default',
  disabled = false,
}: {
  children: React.ReactNode
  tone?: 'default' | 'primary' | 'danger' | 'success'
  disabled?: boolean
}) {
  const tones = {
    default:
      'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
    primary: 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700',
    danger: 'border border-red-600 bg-red-600 text-white hover:bg-red-700',
    success:
      'border border-green-700 bg-green-700 text-white hover:bg-green-800',
  }

  return (
    <button
      disabled={disabled}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

export default async function MobileOrderDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const sp = searchParams ? await searchParams : {}

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select(
      'id, order_no, order_type, customer_name, address, note, status, image_path, image_paths, created_at'
    )
    .eq('id', id)
    .single()

  if (error || !order) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-5 text-gray-950">
        <div className="mx-auto max-w-lg space-y-4">
          <Link href="/mobile/orders" className="text-blue-700 underline">
            返回订单列表
          </Link>
          <h1 className="text-2xl font-bold">订单详情</h1>
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            读取订单失败：{error?.message || 'Order not found'}
          </p>
        </div>
      </main>
    )
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select(`
      id,
      sku_snapshot,
      brand_snapshot,
      product_name_cn_snapshot,
      product_name_en_snapshot,
      display_name_snapshot,
      recognized_qty,
      recognized_unit,
      pick_qty,
      shelf_location_snapshot,
      before_qty,
      after_qty,
      match_status,
      created_at
    `)
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      sku,
      brand,
      product_name_cn,
      product_name_en,
      display_name,
      inventory (
        shelf_location,
        quantity_on_hand
      )
    `)
    .eq('is_active', true)
    .order('brand', { ascending: true })
    .order('sku', { ascending: true })

  const imagePaths =
    Array.isArray(order.image_paths) && order.image_paths.length > 0
      ? order.image_paths.filter(Boolean)
      : order.image_path
      ? [order.image_path]
      : []

  const signedImageUrls: {
    path: string
    url: string
  }[] = []

  for (const imagePath of imagePaths) {
    const { data: signedData, error: signedError } =
      await supabaseAdmin.storage
        .from('order-images')
        .createSignedUrl(imagePath, 60 * 10)

    if (!signedError && signedData?.signedUrl) {
      signedImageUrls.push({
        path: imagePath,
        url: signedData.signedUrl,
      })
    }
  }

  const safeItems = (items || []) as OrderItem[]
  const safeProducts = (products || []) as ProductWithInventory[]
  const isClosed = order.status === 'completed' || order.status === 'cancelled'

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-5 text-gray-950">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="space-y-3 border-b border-gray-200 pb-4">
          <Link href="/mobile/orders" className="text-sm text-blue-700">
            返回手机端订单
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">
              Mobile Order
            </p>
            <h1 className="text-2xl font-bold">{order.order_no}</h1>
          </div>
          <span
            className={`inline-flex rounded px-2 py-1 text-xs font-medium ${getOrderStatusClass(
              order.status
            )}`}
          >
            {getOrderStatusLabel(order.status)}
          </span>
        </header>

        {sp.success && (
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {sp.success}
          </p>
        )}

        {sp.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {sp.error}
          </p>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">订单信息</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">客户名</p>
              <p className="font-medium">{order.customer_name || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">地址</p>
              <p className="font-medium">{order.address || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">备注</p>
              <p>{order.note || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">创建时间</p>
              <p>
                {order.created_at
                  ? new Date(order.created_at).toLocaleString()
                  : '-'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">手机端操作</h2>
          <div className="space-y-3">
            <form action={confirmMobileOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button
                tone="success"
                disabled={
                  isClosed ||
                  order.status === 'picking' ||
                  order.status === 'picking_editing'
                }
              >
                确认订单并进入拣货
              </Button>
            </form>

            {order.status === 'picking' && (
              <form action={completeMobilePicking}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button tone="primary">完成拣货</Button>
              </form>
            )}

            {order.status === 'picking_editing' && (
              <form action={saveMobilePickingEdit}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button tone="primary">保存拣货修改</Button>
              </form>
            )}

            <form
              action={cancelMobileOrder}
              className="space-y-2 rounded-lg border border-red-100 bg-red-50 p-3"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <label className="flex items-center gap-2 text-sm text-red-800">
                <input
                  type="checkbox"
                  name="confirmCancel"
                  value="yes"
                  required
                  disabled={order.status === 'cancelled'}
                />
                确认取消这个订单
              </label>
              <Button
                tone="danger"
                disabled={order.status === 'cancelled'}
              >
                取消订单
              </Button>
            </form>
          </div>
        </section>

        <details className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-lg font-semibold">
            编辑订单信息
          </summary>
          <form action={updateMobileOrderInfo} className="mt-4 space-y-3">
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label className="mb-1 block text-sm font-medium">客户名</label>
              <input
                name="customerName"
                defaultValue={order.customer_name || ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="可选"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">地址</label>
              <textarea
                name="address"
                defaultValue={order.address || ''}
                className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">备注</label>
              <textarea
                name="note"
                defaultValue={order.note || ''}
                className="min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <Button tone="primary" disabled={isClosed}>
              保存订单信息
            </Button>
          </form>
        </details>

        <details className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-lg font-semibold">
            补传截图
          </summary>
          <form
            action={uploadMobileOrderImages}
            encType="multipart/form-data"
            className="mt-4 space-y-3"
          >
            <input type="hidden" name="orderId" value={order.id} />
            <input
              type="file"
              name="images"
              accept="image/*"
              multiple
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <Button tone="primary" disabled={isClosed}>
              上传截图
            </Button>
          </form>
        </details>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">订单截图</h2>
            <span className="text-sm text-gray-500">
              {signedImageUrls.length} 张
            </span>
          </div>

          {signedImageUrls.length > 0 ? (
            <div className="space-y-4">
              {signedImageUrls.map((image, index) => (
                <div key={image.path} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">截图 {index + 1}</p>
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-700 underline"
                    >
                      打开原图
                    </a>
                  </div>
                  <Image
                    src={image.url}
                    alt={`Order image ${index + 1}`}
                    width={900}
                    height={1200}
                    unoptimized
                    className="w-full rounded-lg border border-gray-200"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">没有找到订单图片</p>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">商品明细</h2>

          {itemsError && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              读取商品明细失败：{itemsError.message}
            </p>
          )}

          {safeItems.length === 0 ? (
            <p className="text-sm text-gray-500">这个订单还没有商品</p>
          ) : (
            <div className="space-y-3">
              {safeItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {item.display_name_snapshot ||
                          item.product_name_cn_snapshot ||
                          item.product_name_en_snapshot ||
                          '-'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.brand_snapshot || '-'} | {item.sku_snapshot || '-'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${getItemStatusClass(
                        item.match_status
                      )}`}
                    >
                      {getItemStatusLabel(item.match_status)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded bg-white p-2">
                      <p className="text-xs text-gray-500">识别</p>
                      <p className="font-bold">
                        {item.recognized_qty} {item.recognized_unit || '支'}
                      </p>
                    </div>
                    <div className="rounded bg-white p-2">
                      <p className="text-xs text-gray-500">拣货</p>
                      <p className="font-bold">{item.pick_qty}</p>
                    </div>
                    <div className="rounded bg-white p-2">
                      <p className="text-xs text-gray-500">库位</p>
                      <p className="truncate font-bold">
                        {item.shelf_location_snapshot || '确认'}
                      </p>
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                      修改/删除
                    </summary>
                    <div className="mt-3 space-y-3">
                      <form
                        action={updateMobileOrderItem}
                        className="grid grid-cols-2 gap-2"
                      >
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input
                          type="number"
                          min={1}
                          name="qty"
                          defaultValue={item.recognized_qty}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                          required
                        />
                        <select
                          name="unit"
                          defaultValue={item.recognized_unit || '支'}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        >
                          <option value="支">支</option>
                          <option value="盒">盒</option>
                        </select>
                        <div className="col-span-2">
                          <Button tone="primary" disabled={isClosed}>
                            保存商品数量
                          </Button>
                        </div>
                      </form>

                      <form
                        action={deleteMobileOrderItem}
                        className="space-y-2 rounded-lg border border-red-100 bg-red-50 p-3"
                      >
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <label className="flex items-center gap-2 text-sm text-red-800">
                          <input
                            type="checkbox"
                            name="confirmDelete"
                            value="yes"
                            required
                            disabled={isClosed}
                          />
                          确认删除这个商品
                        </label>
                        <Button tone="danger" disabled={isClosed}>
                          删除商品
                        </Button>
                      </form>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>

        <details className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-lg font-semibold">
            添加商品
          </summary>

          {productsError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              读取商品列表失败：{productsError.message}
            </p>
          )}

          <form action={addMobileOrderItem} className="mt-4 space-y-3">
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label className="mb-1 block text-sm font-medium">商品</label>
              <select
                name="productId"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                required
              >
                <option value="">请选择商品</option>
                {safeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {getProductLabel(product)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium">数量</label>
                <input
                  type="number"
                  min={1}
                  name="qty"
                  defaultValue={1}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">单位</label>
                <select
                  name="unit"
                  defaultValue="支"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="支">支</option>
                  <option value="盒">盒</option>
                </select>
              </div>
            </div>

            <Button tone="primary" disabled={isClosed}>
              添加商品
            </Button>
          </form>
        </details>

        <Link
          href={`/admin/orders/${order.id}`}
          className="block rounded-lg border border-gray-300 bg-white p-3 text-center text-sm font-medium text-gray-800"
        >
          打开电脑端详情页
        </Link>
      </div>
    </main>
  )
}
