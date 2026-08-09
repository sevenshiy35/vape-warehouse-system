import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

type OrderItemRow = {
  id: string
  product_id: string | null
  recognized_qty: number | null
  recognized_unit: string | null
}

type ProductRow = {
  id: string
  sku: string | null
  brand: string | null
  product_name_cn: string | null
  product_name_en: string | null
  display_name: string | null
  default_pick_multiplier: number | null
  carton_pick_multiplier: number | null
  inventory:
    | {
        shelf_location: string | null
        quantity_on_hand: number | null
      }
    | {
        shelf_location: string | null
        quantity_on_hand: number | null
      }[]
    | null
}

function getInventory(product: ProductRow) {
  if (Array.isArray(product.inventory)) {
    return product.inventory[0] || null
  }

  return product.inventory
}

function getPickQty(item: OrderItemRow, product: ProductRow) {
  const quantity = Math.max(0, Number(item.recognized_qty || 0))
  const unit = String(item.recognized_unit || '支').trim().toLowerCase()

  if (unit === '盒' || unit === 'box') {
    return quantity * Math.max(1, Number(product.default_pick_multiplier || 1))
  }

  if (unit === '条' || unit === 'carton') {
    return quantity * Math.max(1, Number(product.carton_pick_multiplier || 1))
  }

  return quantity
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orderId = String(body.orderId || '').trim()

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status !== 'uploaded' && order.status !== 'need_review') {
      return NextResponse.json(
        { error: 'Only unconfirmed orders can recalculate inventory forecasts' },
        { status: 409 }
      )
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('id, product_id, recognized_qty, recognized_unit')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (itemsError) {
      return NextResponse.json(
        { error: itemsError.message },
        { status: 400 }
      )
    }

    const orderItems = (items || []) as OrderItemRow[]
    const productIds = [
      ...new Set(
        orderItems
          .map((item) => item.product_id)
          .filter((productId): productId is string => Boolean(productId))
      ),
    ]

    const productsById = new Map<string, ProductRow>()

    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabaseAdmin
        .from('products')
        .select(`
          id,
          sku,
          brand,
          product_name_cn,
          product_name_en,
          display_name,
          default_pick_multiplier,
          carton_pick_multiplier,
          inventory (
            shelf_location,
            quantity_on_hand
          )
        `)
        .in('id', productIds)

      if (productsError) {
        return NextResponse.json(
          { error: productsError.message },
          { status: 400 }
        )
      }

      for (const product of (products || []) as ProductRow[]) {
        productsById.set(product.id, product)
      }
    }

    const remainingByProduct = new Map<string, number>()
    const updates: {
      itemId: string
      values: Record<string, string | number | null>
      status: string
      pickQty: number
    }[] = []

    for (const item of orderItems) {
      const product = item.product_id
        ? productsById.get(item.product_id)
        : undefined

      if (!product || !item.product_id) {
        updates.push({
          itemId: item.id,
          values: {
            shelf_location_snapshot: null,
            before_qty: null,
            after_qty: null,
            match_status: 'not_found',
          },
          status: 'not_found',
          pickQty: 0,
        })
        continue
      }

      const inventory = getInventory(product)
      const shelfLocation = String(inventory?.shelf_location || '').trim() || null
      const currentStock = Number(inventory?.quantity_on_hand || 0)
      const beforeQty = remainingByProduct.has(item.product_id)
        ? remainingByProduct.get(item.product_id) || 0
        : currentStock
      const pickQty = getPickQty(item, product)
      const afterQty = beforeQty - pickQty
      const matchStatus =
        afterQty < 0
          ? 'out_of_stock'
          : !shelfLocation && pickQty > 0
            ? 'need_review'
            : 'matched'

      remainingByProduct.set(item.product_id, afterQty)
      updates.push({
        itemId: item.id,
        values: {
          quantity: Number(item.recognized_qty || 0),
          sku_snapshot: product.sku,
          brand_snapshot: product.brand,
          product_name_cn_snapshot: product.product_name_cn,
          product_name_en_snapshot: product.product_name_en,
          display_name_snapshot: product.display_name,
          pick_qty: pickQty,
          shelf_location_snapshot: shelfLocation,
          before_qty: beforeQty,
          after_qty: afterQty,
          match_status: matchStatus,
        },
        status: matchStatus,
        pickQty,
      })
    }

    // Re-check immediately before writing so a just-confirmed order keeps its
    // historical deduction snapshots unchanged.
    const { data: currentOrder, error: currentOrderError } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()

    if (
      currentOrderError ||
      !currentOrder ||
      (currentOrder.status !== 'uploaded' && currentOrder.status !== 'need_review')
    ) {
      return NextResponse.json(
        { error: 'Order status changed; inventory forecast was not updated' },
        { status: 409 }
      )
    }

    const updateResults = await Promise.all(
      updates.map((update) =>
        supabaseAdmin
          .from('order_items')
          .update(update.values)
          .eq('id', update.itemId)
          .eq('order_id', orderId)
      )
    )
    const failedUpdate = updateResults.find((result) => result.error)

    if (failedUpdate?.error) {
      return NextResponse.json(
        { error: failedUpdate.error.message },
        { status: 400 }
      )
    }

    const totalItems = updates.reduce((sum, update) => sum + update.pickQty, 0)
    const { error: totalError } = await supabaseAdmin
      .from('orders')
      .update({
        total_items: totalItems,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .in('status', ['uploaded', 'need_review'])

    if (totalError) {
      return NextResponse.json(
        { error: totalError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      updated: updates.length,
      available: updates.filter((update) => update.status === 'matched').length,
      insufficient: updates.filter(
        (update) => update.status === 'out_of_stock'
      ).length,
      needsReview: updates.filter((update) =>
        update.status === 'need_review' || update.status === 'not_found'
      ).length,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Unexpected error') },
      { status: 500 }
    )
  }
}
