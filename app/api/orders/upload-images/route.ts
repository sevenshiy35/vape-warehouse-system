import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

    const orderId = String(formData.get('orderId') || '').trim()

    const files = formData
      .getAll('images')
      .filter((value): value is File => value instanceof File && value.size > 0)

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      )
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: '请至少选择一张图片' },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_no, status, image_path, image_paths')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status === 'cancelled') {
      return NextResponse.json(
        { error: '已取消订单不能补传截图' },
        { status: 400 }
      )
    }

    if (order.status === 'completed') {
      return NextResponse.json(
        { error: '已完成订单不建议补传截图' },
        { status: 400 }
      )
    }

    const existingPaths =
      Array.isArray(order.image_paths) && order.image_paths.length > 0
        ? order.image_paths.filter(Boolean)
        : order.image_path
        ? [order.image_path]
        : []

    const uploadedPaths: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = getFileExt(file)
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const nextIndex = existingPaths.length + uploadedPaths.length + 1
      const imagePath = `orders/${order.order_no}/image-${String(
        nextIndex
      ).padStart(2, '0')}-${Date.now()}.${ext}`

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

    const newImagePaths = [...existingPaths, ...uploadedPaths]

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        image_path: newImagePaths[0] || null,
        image_paths: newImagePaths,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, order_no, image_path, image_paths')
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      uploadedPaths,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '补传截图失败' },
      { status: 500 }
    )
  }
}