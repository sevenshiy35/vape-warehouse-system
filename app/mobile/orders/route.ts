import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  escapeHtml,
  getOrderStatusClass,
  getOrderStatusLabel,
  htmlResponse,
} from '../_lib'
import { formatEasternTime } from '@/lib/time'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const success = url.searchParams.get('success')
  const errorMessage = url.searchParams.get('error')

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_no, address, note, status, total_items, created_at')
    .order('created_at', { ascending: false })
    .limit(80)

  const notices = [
    success
      ? `<p class="notice ok">${escapeHtml(success)}</p>`
      : '',
    errorMessage
      ? `<p class="notice err">${escapeHtml(errorMessage)}</p>`
      : '',
    error
      ? `<p class="notice err">读取订单失败：${escapeHtml(error.message)}</p>`
      : '',
  ].join('')

  const orderCards = (orders || [])
    .map(
      (order) => `
        <a class="card stack" href="/mobile/orders/${escapeHtml(order.id)}" style="display:block;text-decoration:none;color:inherit">
          <div class="row">
            <div style="min-width:0">
              <p style="font-size:21px;font-weight:800;color:#1d4ed8">${escapeHtml(order.order_no)}</p>
              <p class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(order.address || '-')}</p>
            </div>
            <span class="${getOrderStatusClass(order.status)}">${getOrderStatusLabel(order.status)}</span>
          </div>
          <div class="row" style="border-top:1px solid #f3f4f6;padding-top:10px">
            <span class="muted">商品：${escapeHtml(order.total_items ?? '-')}</span>
            <span class="muted">${escapeHtml(
              formatEasternTime(order.created_at)
            )}</span>
          </div>
        </a>
      `
    )
    .join('')

  return htmlResponse(
    '订单列表',
    `
      <main class="stack">
        <header class="stack">
          <a class="nav-back" href="/mobile">首页</a>
          <p class="eyebrow">Orders</p>
          <h1>订单列表</h1>
          <div class="grid2">
            <a class="btn btn-dark" href="/mobile/submit-order">提交订单</a>
            <a class="btn" href="/">首页</a>
          </div>
        </header>
        ${notices}
        <section class="stack">
          ${orderCards || '<p class="card muted">暂无订单</p>'}
        </section>
      </main>
    `
  )
}
