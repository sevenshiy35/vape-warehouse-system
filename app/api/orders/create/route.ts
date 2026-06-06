import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'
import { recognizeAndAutoAddOrder } from '@/lib/orderRecognition'

export const runtime = 'nodejs'
export const maxDuration = 60

function wantsJsonResponse(request: Request) {
  const accept = request.headers.get('accept') || ''

  return (
    request.headers.get('x-requested-with') === 'fetch' ||
    accept.includes('application/json')
  )
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function errorResponse(
  request: Request,
  message: string,
  status = 400,
  returnHref = '/submit-order'
) {
  if (wantsJsonResponse(request)) {
    return NextResponse.json({ error: message }, { status })
  }

  const safeMessage = htmlEscape(message)

  return new NextResponse(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>提交订单失败</title></head><body style="font-family:system-ui,sans-serif;padding:24px;line-height:1.6"><h1>提交订单失败</h1><p>${safeMessage}</p><p><a href="${htmlEscape(returnHref)}">返回重新提交</a></p></body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    }
  )
}

function getFileExt(file: File) {
  const name = file.name || ''
  const fromName = name.split('.').pop()?.toLowerCase()

  if (
    fromName &&
    ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(fromName)
  ) {
    return fromName
  }

  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'image/heif') return 'heif'

  return 'jpg'
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const files = formData
      .getAll('images')
      .filter((value): value is File => value instanceof File && value.size > 0)

    // 兼容旧版本单图字段 image
    const oldSingleImage = formData.get('image')
    if (
      files.length === 0 &&
      oldSingleImage instanceof File &&
      oldSingleImage.size > 0
    ) {
      files.push(oldSingleImage)
    }

    const customerName = String(formData.get('customerName') || '').trim()
    const address = String(formData.get('address') || '').trim()
    const note = String(formData.get('note') || '').trim()

    if (files.length === 0) {
      return errorResponse(request, '请至少上传一张订单截图', 400)
    }

    if (!address) {
      return errorResponse(request, '请填写地址', 400)
    }

    const { data: orderNo, error: orderNoError } = await supabaseAdmin.rpc(
      'next_order_no'
    )

    if (orderNoError || !orderNo) {
      return errorResponse(
        request,
        orderNoError?.message || '生成 OrderID 失败',
        400
      )
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
        return errorResponse(
          request,
          `上传第 ${i + 1} 张图片失败：${uploadError.message}`,
          400
        )
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
        ai_status: 'not_started',
        ai_error: null,
        ai_processed_at: null,
      })
      .select(
        'id, order_no, address, note, status, image_path, image_paths, ai_status'
      )
      .single()

    if (insertError) {
      return errorResponse(request, insertError.message, 400)
    }

    after(async () => {
      try {
        await recognizeAndAutoAddOrder(order.id)
      } catch (error: unknown) {
        console.error(
          `Background AI recognition failed for order ${order.id}:`,
          error
        )
      }
    })

    if (!wantsJsonResponse(request)) {
      return new NextResponse(null, {
        status: 303,
        headers: {
          Location: `/admin/orders/${order.id}`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      aiQueued: true,
      order,
    })
  } catch (error: unknown) {
    return errorResponse(
      request,
      getErrorMessage(error, '创建订单失败'),
      500
    )
  }
}
