import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

function getFileExt(file: File) {
  const name = file.name || ''
  const fromName = name.split('.').pop()?.toLowerCase()

  if (fromName && ['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) {
    return fromName
  }

  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/jpeg') return 'jpg'

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
      return NextResponse.json(
        { error: '请至少上传一张订单截图' },
        { status: 400 }
      )
    }

    if (!address) {
      return NextResponse.json(
        { error: '请填写地址' },
        { status: 400 }
      )
    }

    const { data: orderNo, error: orderNoError } = await supabaseAdmin.rpc(
      'next_order_no'
    )

    if (orderNoError || !orderNo) {
      return NextResponse.json(
        { error: orderNoError?.message || '生成 OrderID 失败' },
        { status: 400 }
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
        return NextResponse.json(
          { error: `上传第 ${i + 1} 张图片失败：${uploadError.message}` },
          { status: 400 }
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
      })
      .select(
        'id, order_no, address, note, status, image_path, image_paths'
      )
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      order,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, '创建订单失败') },
      { status: 500 }
    )
  }
}
