import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'
import {
  escapeHtml,
  getFileExt,
  htmlResponse,
  redirectTo,
  withMessage,
} from '../_lib'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function formHtml(error?: string) {
  return htmlResponse(
    '提交订单',
    `
      <main class="stack">
        <header class="stack">
          <a class="nav-back" href="/mobile">首页</a>
          <p class="eyebrow">Order</p>
          <h1>提交新订单</h1>
        </header>
        ${error ? `<p class="notice err">${escapeHtml(error)}</p>` : ''}
        <form class="card stack" action="/mobile/submit-order" method="post" enctype="multipart/form-data">
          <div>
            <label>订单截图</label>
            <input type="file" name="images" accept="image/*" multiple required>
            <p class="muted" style="margin-top:6px">选择订单截图后提交，系统会保存图片和订单信息。</p>
          </div>
          <div>
            <label>客户名</label>
            <input name="customerName" placeholder="可选">
          </div>
          <div>
            <label>地址</label>
            <textarea name="address" required placeholder="例如：615 Pavonia Avenue, Unit #4406"></textarea>
          </div>
          <div>
            <label>备注</label>
            <textarea name="note" placeholder="门禁、到店备注、特殊说明"></textarea>
          </div>
          <button class="btn-dark">提交订单</button>
        </form>
      </main>
    `,
    error ? 400 : 200
  )
}

export function GET() {
  return formHtml()
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData
      .getAll('images')
      .filter((value): value is File => value instanceof File && value.size > 0)
    const customerName = String(formData.get('customerName') || '').trim()
    const address = String(formData.get('address') || '').trim()
    const note = String(formData.get('note') || '').trim()

    if (files.length === 0) return formHtml('请至少上传一张订单截图')
    if (!address) return formHtml('请填写地址')

    const { data: orderNo, error: orderNoError } = await supabaseAdmin.rpc(
      'next_order_no'
    )

    if (orderNoError || !orderNo) {
      return formHtml(orderNoError?.message || '生成 OrderID 失败')
    }

    const uploadedPaths: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = getFileExt(file)
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const imagePath = `orders/${orderNo}/image-${String(i + 1).padStart(
        2,
        '0'
      )}.${ext}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('order-images')
        .upload(imagePath, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        })

      if (uploadError) {
        return formHtml(`上传第 ${i + 1} 张图片失败：${uploadError.message}`)
      }

      uploadedPaths.push(imagePath)
    }

    const { data: order, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_no: orderNo,
        order_type: 'order',
        customer_name: customerName || null,
        address,
        note: note || null,
        image_path: uploadedPaths[0],
        image_paths: uploadedPaths,
        status: 'uploaded',
      })
      .select('id')
      .single()

    if (insertError || !order) {
      return formHtml(insertError?.message || '创建订单失败')
    }

    return redirectTo(
      withMessage(`/mobile/orders/${order.id}`, 'success', '订单创建成功')
    )
  } catch (error: unknown) {
    return formHtml(getErrorMessage(error, '创建订单失败'))
  }
}
