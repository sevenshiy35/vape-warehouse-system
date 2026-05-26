'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

function mobileOrderHref(orderId: string, params?: Record<string, string>) {
  const query = new URLSearchParams(params).toString()
  return query
    ? `/mobile/orders/${orderId}?${query}`
    : `/mobile/orders/${orderId}`
}

function success(orderId: string, message: string): never {
  revalidatePath(`/mobile/orders/${orderId}`)
  revalidatePath('/mobile/orders')
  redirect(mobileOrderHref(orderId, { success: message }))
}

function fail(orderId: string, message: string): never {
  redirect(mobileOrderHref(orderId, { error: message }))
}

function requireOrderId(formData: FormData) {
  const orderId = String(formData.get('orderId') || '').trim()

  if (!orderId) {
    redirect('/mobile/orders?error=Missing orderId')
  }

  return orderId
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

export async function confirmMobileOrder(formData: FormData) {
  const orderId = requireOrderId(formData)

  const { error } = await supabaseAdmin.rpc('confirm_order_and_deduct', {
    p_order_id: orderId,
  })

  if (error) fail(orderId, error.message)

  success(orderId, '订单已确认，已进入拣货中')
}

export async function cancelMobileOrder(formData: FormData) {
  const orderId = requireOrderId(formData)

  if (formData.get('confirmCancel') !== 'yes') {
    fail(orderId, '请先勾选确认取消')
  }

  const { error } = await supabaseAdmin.rpc('cancel_order_and_restore', {
    p_order_id: orderId,
  })

  if (error) fail(orderId, error.message)

  success(orderId, '订单已取消')
}

export async function completeMobilePicking(formData: FormData) {
  const orderId = requireOrderId(formData)

  const { error } = await supabaseAdmin.rpc('complete_picking_order', {
    p_order_id: orderId,
  })

  if (error) fail(orderId, error.message)

  success(orderId, '拣货已完成')
}

export async function saveMobilePickingEdit(formData: FormData) {
  const orderId = requireOrderId(formData)

  const { error } = await supabaseAdmin.rpc('save_picking_edit', {
    p_order_id: orderId,
  })

  if (error) fail(orderId, error.message)

  success(orderId, '拣货修改已保存')
}

export async function updateMobileOrderInfo(formData: FormData) {
  const orderId = requireOrderId(formData)
  const customerName = String(formData.get('customerName') || '').trim()
  const address = String(formData.get('address') || '').trim()
  const note = String(formData.get('note') || '').trim()

  if (!address) fail(orderId, '地址不能为空')

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    fail(orderId, orderError?.message || 'Order not found')
  }

  if (order.status === 'completed') {
    fail(orderId, '已完成订单不能修改订单信息')
  }

  if (order.status === 'cancelled') {
    fail(orderId, '已取消订单不能修改订单信息')
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      customer_name: customerName || null,
      address,
      note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) fail(orderId, error.message)

  success(orderId, '订单信息已保存')
}

export async function uploadMobileOrderImages(formData: FormData) {
  const orderId = requireOrderId(formData)
  const files = formData
    .getAll('images')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (files.length === 0) fail(orderId, '请至少选择一张图片')

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, order_no, status, image_path, image_paths')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    fail(orderId, orderError?.message || 'Order not found')
  }

  if (order.status === 'cancelled') {
    fail(orderId, '已取消订单不能补传截图')
  }

  if (order.status === 'completed') {
    fail(orderId, '已完成订单不建议补传截图')
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
      fail(orderId, `上传第 ${i + 1} 张图片失败：${uploadError.message}`)
    }

    uploadedPaths.push(imagePath)
  }

  const newImagePaths = [...existingPaths, ...uploadedPaths]

  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      image_path: newImagePaths[0] || null,
      image_paths: newImagePaths,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) fail(orderId, error.message)

  success(orderId, '截图已补传')
}

export async function addMobileOrderItem(formData: FormData) {
  const orderId = requireOrderId(formData)
  const productId = String(formData.get('productId') || '').trim()
  const qty = Number(formData.get('qty'))
  const unit = String(formData.get('unit') || '支')

  if (!productId) fail(orderId, '请选择商品')
  if (!qty || qty <= 0) fail(orderId, '请输入正确数量')

  const { error } = await supabaseAdmin.rpc('add_order_item_safe', {
    p_order_id: orderId,
    p_product_id: productId,
    p_qty: qty,
    p_unit: unit,
  })

  if (error) fail(orderId, error.message)

  success(orderId, '商品已添加')
}

export async function updateMobileOrderItem(formData: FormData) {
  const orderId = requireOrderId(formData)
  const itemId = String(formData.get('itemId') || '').trim()
  const qty = Number(formData.get('qty'))
  const unit = String(formData.get('unit') || '支')

  if (!itemId) fail(orderId, 'Missing itemId')
  if (!qty || qty <= 0) fail(orderId, '请输入正确数量')

  const { error } = await supabaseAdmin.rpc('update_order_item_safe', {
    p_item_id: itemId,
    p_qty: qty,
    p_unit: unit,
  })

  if (error) fail(orderId, error.message)

  success(orderId, '商品数量已更新')
}

export async function deleteMobileOrderItem(formData: FormData) {
  const orderId = requireOrderId(formData)
  const itemId = String(formData.get('itemId') || '').trim()

  if (!itemId) fail(orderId, 'Missing itemId')
  if (formData.get('confirmDelete') !== 'yes') {
    fail(orderId, '请先勾选确认删除')
  }

  const { error } = await supabaseAdmin.rpc('delete_order_item_safe', {
    p_item_id: itemId,
  })

  if (error) fail(orderId, error.message)

  success(orderId, '商品已删除')
}

export async function safeMobileAction(formData: FormData) {
  const orderId = requireOrderId(formData)

  try {
    const action = String(formData.get('action') || '')

    if (action === 'confirm') return confirmMobileOrder(formData)
    if (action === 'cancel') return cancelMobileOrder(formData)
    if (action === 'completePicking') return completeMobilePicking(formData)
    if (action === 'savePickingEdit') return saveMobilePickingEdit(formData)
    if (action === 'updateInfo') return updateMobileOrderInfo(formData)
    if (action === 'uploadImages') return uploadMobileOrderImages(formData)
    if (action === 'addItem') return addMobileOrderItem(formData)
    if (action === 'updateItem') return updateMobileOrderItem(formData)
    if (action === 'deleteItem') return deleteMobileOrderItem(formData)

    fail(orderId, '未知操作')
  } catch (error: unknown) {
    fail(orderId, getErrorMessage(error, '操作失败'))
  }
}
