import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getInventoryRecord, type ProductWithInventory } from '@/lib/types'
import { formatEasternTime } from '@/lib/time'
import {
  escapeHtml,
  getItemStatusClass,
  getItemStatusLabel,
  getOrderStatusClass,
  getOrderStatusLabel,
  htmlResponse,
} from '../../_lib'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{
    id: string
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

function productLabel(product: ProductWithInventory) {
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

function hiddenOrderId(orderId: string) {
  return `<input type="hidden" name="orderId" value="${escapeHtml(orderId)}">`
}

function disabledAttr(disabled: boolean) {
  return disabled ? 'disabled' : ''
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const url = new URL(request.url)
  const success = url.searchParams.get('success')
  const errorMessage = url.searchParams.get('error')

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select(
      'id, order_no, order_type, customer_name, address, note, status, image_path, image_paths, created_at'
    )
    .eq('id', id)
    .single()

  if (error || !order) {
    return htmlResponse(
      '订单详情',
      `<main class="stack"><a class="nav-back" href="/mobile/orders">订单列表</a><h1>订单详情</h1><p class="notice err">读取订单失败：${escapeHtml(
        error?.message || 'Order not found'
      )}</p></main>`,
      404
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

  const signedImages: { path: string; url: string }[] = []

  for (const imagePath of imagePaths) {
    const { data: signedData, error: signedError } =
      await supabaseAdmin.storage
        .from('order-images')
        .createSignedUrl(imagePath, 60 * 10)

    if (!signedError && signedData?.signedUrl) {
      signedImages.push({ path: imagePath, url: signedData.signedUrl })
    }
  }

  const safeItems = (items || []) as OrderItem[]
  const safeProducts = (products || []) as ProductWithInventory[]
  const isClosed = order.status === 'completed' || order.status === 'cancelled'
  const actionPath = `/mobile/orders/${order.id}/actions`

  const notices = [
    success
      ? `<p class="notice ok">${escapeHtml(success)}</p>`
      : '',
    errorMessage
      ? `<p class="notice err">${escapeHtml(errorMessage)}</p>`
      : '',
    itemsError
      ? `<p class="notice err">读取商品明细失败：${escapeHtml(itemsError.message)}</p>`
      : '',
    productsError
      ? `<p class="notice err">读取商品列表失败：${escapeHtml(productsError.message)}</p>`
      : '',
  ].join('')

  const imageHtml =
    signedImages
      .map(
        (image, index) => `
          <div class="stack">
            <div class="row">
              <p class="small"><b>截图 ${index + 1}</b></p>
              <a class="small" href="${escapeHtml(image.url)}" target="_blank" rel="noreferrer">打开原图</a>
            </div>
            <img src="${escapeHtml(image.url)}" alt="订单截图 ${index + 1}">
          </div>
        `
      )
      .join('') || '<p class="muted">没有找到订单图片</p>'

  const itemHtml =
    safeItems
      .map(
        (item) => `
          <article class="card stack">
            <div class="row">
              <div style="min-width:0">
                <p class="value">${escapeHtml(
                  item.display_name_snapshot ||
                    item.product_name_cn_snapshot ||
                    item.product_name_en_snapshot ||
                    '-'
                )}</p>
                <p class="muted">${escapeHtml(item.brand_snapshot || '-')} | ${escapeHtml(item.sku_snapshot || '-')}</p>
              </div>
              <span class="${getItemStatusClass(item.match_status)}">${getItemStatusLabel(item.match_status)}</span>
            </div>
            <div class="grid3">
              <div class="card" style="box-shadow:none;padding:8px"><p class="label">识别</p><p class="value">${escapeHtml(item.recognized_qty)} ${escapeHtml(item.recognized_unit || '支')}</p></div>
              <div class="card" style="box-shadow:none;padding:8px"><p class="label">拣货</p><p class="value">${escapeHtml(item.pick_qty)}</p></div>
              <div class="card" style="box-shadow:none;padding:8px"><p class="label">库位</p><p class="value">${escapeHtml(item.shelf_location_snapshot || '确认')}</p></div>
            </div>
            <details>
              <summary>修改/删除</summary>
              <div class="stack">
                <form class="stack" action="${actionPath}" method="post">
                  ${hiddenOrderId(order.id)}
                  <input type="hidden" name="action" value="updateItem">
                  <input type="hidden" name="itemId" value="${escapeHtml(item.id)}">
                  <div class="grid2">
                    <input type="number" min="1" name="qty" value="${escapeHtml(item.recognized_qty)}" required>
                    <select name="unit">
                      <option value="支" ${item.recognized_unit !== '盒' ? 'selected' : ''}>支</option>
                      <option value="盒" ${item.recognized_unit === '盒' ? 'selected' : ''}>盒</option>
                    </select>
                  </div>
                  <button class="btn-primary" ${disabledAttr(isClosed)}>保存商品数量</button>
                </form>
                <form class="danger-zone stack" action="${actionPath}" method="post">
                  ${hiddenOrderId(order.id)}
                  <input type="hidden" name="action" value="deleteItem">
                  <input type="hidden" name="itemId" value="${escapeHtml(item.id)}">
                  <label><input type="checkbox" name="confirmDelete" value="yes" required ${disabledAttr(isClosed)}> 确认删除这个商品</label>
                  <button class="btn-danger" ${disabledAttr(isClosed)}>删除商品</button>
                </form>
              </div>
            </details>
          </article>
        `
      )
      .join('') || '<p class="card muted">这个订单还没有商品</p>'

  const productOptions = safeProducts
    .map(
      (product) =>
        `<option value="${escapeHtml(product.id)}">${escapeHtml(productLabel(product))}</option>`
    )
    .join('')

  return htmlResponse(
    `订单 ${order.order_no}`,
    `
      <main class="stack">
        <header class="stack">
          <a class="nav-back" href="/mobile/orders">订单列表</a>
          <p class="eyebrow">Order</p>
          <h1>${escapeHtml(order.order_no)}</h1>
          <span class="${getOrderStatusClass(order.status)}">${getOrderStatusLabel(order.status)}</span>
        </header>
        ${notices}
        <section class="card stack">
          <h2>订单信息</h2>
          <div><p class="label">客户名</p><p class="value">${escapeHtml(order.customer_name || '-')}</p></div>
          <div><p class="label">地址</p><p class="value">${escapeHtml(order.address || '-')}</p></div>
          <div><p class="label">备注</p><p>${escapeHtml(order.note || '-')}</p></div>
          <div><p class="label">创建时间</p><p>${escapeHtml(formatEasternTime(order.created_at))}</p></div>
        </section>

        <section class="card stack">
          <h2>订单操作</h2>
          <form action="${actionPath}" method="post">
            ${hiddenOrderId(order.id)}
            <input type="hidden" name="action" value="confirm">
            <button class="btn-success" ${disabledAttr(isClosed || order.status === 'picking' || order.status === 'picking_editing')}>确认订单并进入拣货</button>
          </form>
          ${
            order.status === 'picking'
              ? `<form action="${actionPath}" method="post">${hiddenOrderId(order.id)}<input type="hidden" name="action" value="completePicking"><button class="btn-primary">完成拣货</button></form>`
              : ''
          }
          ${
            order.status === 'picking_editing'
              ? `<form action="${actionPath}" method="post">${hiddenOrderId(order.id)}<input type="hidden" name="action" value="savePickingEdit"><button class="btn-primary">保存拣货修改</button></form>`
              : ''
          }
          <form class="danger-zone stack" action="${actionPath}" method="post">
            ${hiddenOrderId(order.id)}
            <input type="hidden" name="action" value="cancel">
            <label><input type="checkbox" name="confirmCancel" value="yes" required ${disabledAttr(order.status === 'cancelled')}> 确认取消这个订单</label>
            <button class="btn-danger" ${disabledAttr(order.status === 'cancelled')}>取消订单</button>
          </form>
        </section>

        <details class="card">
          <summary>编辑订单信息</summary>
          <form class="stack" action="${actionPath}" method="post">
            ${hiddenOrderId(order.id)}
            <input type="hidden" name="action" value="updateInfo">
            <div><label>客户名</label><input name="customerName" value="${escapeHtml(order.customer_name || '')}" placeholder="可选"></div>
            <div><label>地址</label><textarea name="address" required>${escapeHtml(order.address || '')}</textarea></div>
            <div><label>备注</label><textarea name="note">${escapeHtml(order.note || '')}</textarea></div>
            <button class="btn-primary" ${disabledAttr(isClosed)}>保存订单信息</button>
          </form>
        </details>

        <details class="card">
          <summary>补传截图</summary>
          <form class="stack" action="${actionPath}" method="post" enctype="multipart/form-data">
            ${hiddenOrderId(order.id)}
            <input type="hidden" name="action" value="uploadImages">
            <input type="file" name="images" accept="image/*" multiple required>
            <button class="btn-primary" ${disabledAttr(isClosed)}>上传截图</button>
          </form>
        </details>

        <section class="card stack">
          <div class="row"><h2>订单截图</h2><span class="muted">${signedImages.length} 张</span></div>
          ${imageHtml}
        </section>

        <section class="stack">
          <h2>商品明细</h2>
          ${itemHtml}
        </section>

        <details class="card">
          <summary>添加商品</summary>
          <form class="stack" action="${actionPath}" method="post">
            ${hiddenOrderId(order.id)}
            <input type="hidden" name="action" value="addItem">
            <div>
              <label>商品</label>
              <select name="productId" required>
                <option value="">请选择商品</option>
                ${productOptions}
              </select>
            </div>
            <div class="grid2">
              <div><label>数量</label><input type="number" min="1" name="qty" value="1" required></div>
              <div><label>单位</label><select name="unit"><option value="支">支</option><option value="盒">盒</option></select></div>
            </div>
            <button class="btn-primary" ${disabledAttr(isClosed)}>添加商品</button>
          </form>
        </details>

        <a class="btn" href="/admin/orders/${escapeHtml(order.id)}">打开电脑端详情页</a>
      </main>
    `
  )
}
