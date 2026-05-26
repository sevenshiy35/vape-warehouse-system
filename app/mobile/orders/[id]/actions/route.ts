import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'
import { getFileExt, redirectTo, withMessage } from '../../../_lib'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

function detailHref(orderId: string, type: 'success' | 'error', message: string) {
  return withMessage(`/mobile/orders/${orderId}`, type, message)
}

function done(orderId: string, message: string) {
  return redirectTo(detailHref(orderId, 'success', message))
}

function fail(orderId: string, message: string) {
  return redirectTo(detailHref(orderId, 'error', message))
}

function getRouteOrderId(formData: FormData, routeOrderId: string) {
  const formOrderId = String(formData.get('orderId') || '').trim()

  if (formOrderId && formOrderId !== routeOrderId) {
    throw new Error('订单编号不一致，请返回列表后重新打开订单')
  }

  return routeOrderId
}

function getPositiveQty(formData: FormData) {
  const qty = Number(formData.get('qty'))

  if (!qty || qty <= 0) {
    throw new Error('请输入正确数量')
  }

  return qty
}

async function assertEditableOrder(orderId: string) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error(error?.message || 'Order not found')
  }

  if (order.status === 'completed') {
    throw new Error('已完成订单不能修改')
  }

  if (order.status === 'cancelled') {
    throw new Error('已取消订单不能修改')
  }

  return order
}

async function confirmOrder(orderId: string) {
  const { error } = await supabaseAdmin.rpc('confirm_order_and_deduct', {
    p_order_id: orderId,
  })

  if (error) throw new Error(error.message)

  return done(orderId, '订单已确认，已进入拣货中')
}

async function cancelOrder(formData: FormData, orderId: string) {
  if (formData.get('confirmCancel') !== 'yes') {
    throw new Error('请先勾选确认取消')
  }

  const { error } = await supabaseAdmin.rpc('cancel_order_and_restore', {
    p_order_id: orderId,
  })

  if (error) throw new Error(error.message)

  return done(orderId, '订单已取消')
}

async function completePicking(orderId: string) {
  const { error } = await supabaseAdmin.rpc('complete_picking_order', {
    p_order_id: orderId,
  })

  if (error) throw new Error(error.message)

  return done(orderId, '拣货已完成')
}

async function savePickingEdit(orderId: string) {
  const { error } = await supabaseAdmin.rpc('save_picking_edit', {
    p_order_id: orderId,
  })

  if (error) throw new Error(error.message)

  return done(orderId, '拣货修改已保存')
}

async function updateOrderInfo(formData: FormData, orderId: string) {
  await assertEditableOrder(orderId)

  const customerName = String(formData.get('customerName') || '').trim()
  const address = String(formData.get('address') || '').trim()
  const note = String(formData.get('note') || '').trim()

  if (!address) {
    throw new Error('地址不能为空')
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

  if (error) throw new Error(error.message)

  return done(orderId, '订单信息已保存')
}

async function uploadImages(formData: FormData, orderId: string) {
  const files = formData
    .getAll('images')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (files.length === 0) {
    throw new Error('请至少选择一张图片')
  }

  await assertEditableOrder(orderId)

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, order_no, image_path, image_paths')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message || 'Order not found')
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
      throw new Error(`上传第 ${i + 1} 张图片失败：${uploadError.message}`)
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

  if (error) throw new Error(error.message)

  return done(orderId, '截图已补传')
}

async function addItem(formData: FormData, orderId: string) {
  const productId = String(formData.get('productId') || '').trim()
  const qty = getPositiveQty(formData)
  const unit = String(formData.get('unit') || '支')

  if (!productId) {
    throw new Error('请选择商品')
  }

  const { error } = await supabaseAdmin.rpc('add_order_item_safe', {
    p_order_id: orderId,
    p_product_id: productId,
    p_qty: qty,
    p_unit: unit,
  })

  if (error) throw new Error(error.message)

  return done(orderId, '商品已添加')
}

async function updateItem(formData: FormData, orderId: string) {
  const itemId = String(formData.get('itemId') || '').trim()
  const qty = getPositiveQty(formData)
  const unit = String(formData.get('unit') || '支')

  if (!itemId) {
    throw new Error('Missing itemId')
  }

  const { error } = await supabaseAdmin.rpc('update_order_item_safe', {
    p_item_id: itemId,
    p_qty: qty,
    p_unit: unit,
  })

  if (error) throw new Error(error.message)

  return done(orderId, '商品数量已更新')
}

async function deleteItem(formData: FormData, orderId: string) {
  const itemId = String(formData.get('itemId') || '').trim()

  if (!itemId) {
    throw new Error('Missing itemId')
  }

  if (formData.get('confirmDelete') !== 'yes') {
    throw new Error('请先勾选确认删除')
  }

  const { error } = await supabaseAdmin.rpc('delete_order_item_safe', {
    p_item_id: itemId,
  })

  if (error) throw new Error(error.message)

  return done(orderId, '商品已删除')
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const formData = await request.formData()
    const orderId = getRouteOrderId(formData, id)
    const action = String(formData.get('action') || '')

    if (action === 'confirm') return confirmOrder(orderId)
    if (action === 'cancel') return cancelOrder(formData, orderId)
    if (action === 'completePicking') return completePicking(orderId)
    if (action === 'savePickingEdit') return savePickingEdit(orderId)
    if (action === 'updateInfo') return updateOrderInfo(formData, orderId)
    if (action === 'uploadImages') return uploadImages(formData, orderId)
    if (action === 'addItem') return addItem(formData, orderId)
    if (action === 'updateItem') return updateItem(formData, orderId)
    if (action === 'deleteItem') return deleteItem(formData, orderId)

    return fail(orderId, '未知操作')
  } catch (error: unknown) {
    return fail(id, getErrorMessage(error, '操作失败'))
  }
}
