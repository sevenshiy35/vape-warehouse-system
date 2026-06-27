import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

const DEFAULT_OPERATOR = 'Seven'

type ProductSnapshot = {
  sku: string | null
  product_name_cn: string | null
  display_name: string | null
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

function normalizeShelfLocation(value: string | null | undefined) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

function getInventorySnapshot(product: ProductSnapshot | null) {
  if (!product?.inventory) return null
  return Array.isArray(product.inventory)
    ? product.inventory[0] || null
    : product.inventory
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const productId = body.productId as string
    const qty = Number(body.qty)
    const shelfLocation = normalizeShelfLocation(body.shelfLocation as string | null)
    const operator = String(body.operator || DEFAULT_OPERATOR).trim() || DEFAULT_OPERATOR

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive integer' },
        { status: 400 }
      )
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select(`
        sku,
        product_name_cn,
        display_name,
        inventory (
          shelf_location,
          quantity_on_hand
        )
      `)
      .eq('id', productId)
      .single()

    if (productError) {
      return NextResponse.json(
        { error: productError.message },
        { status: 400 }
      )
    }

    const productSnapshot = product as ProductSnapshot
    const inventorySnapshot = getInventorySnapshot(productSnapshot)
    const oldShelfLocation = normalizeShelfLocation(
      inventorySnapshot?.shelf_location
    )
    const beforeQty = Number(inventorySnapshot?.quantity_on_hand || 0)
    const afterQty = beforeQty + qty
    const locationChanged =
      shelfLocation !== null && shelfLocation !== oldShelfLocation

    const { error } = await supabaseAdmin.rpc('inbound_inventory', {
      p_product_id: productId,
      p_qty: qty,
      p_shelf_location: shelfLocation,
      p_operator: operator,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (locationChanged) {
      const { error: locationLogError } = await supabaseAdmin
        .from('inventory_logs')
        .insert({
          product_id: productId,
          sku_snapshot: productSnapshot.sku,
          product_name_snapshot:
            productSnapshot.display_name || productSnapshot.product_name_cn,
          change_qty: 0,
          before_qty: afterQty,
          after_qty: afterQty,
          log_type: 'LocationMove',
          reason: '入库时同步调整库位',
          operator,
          old_shelf_location: oldShelfLocation,
          new_shelf_location: shelfLocation,
        })

      if (locationLogError) {
        return NextResponse.json({
          success: true,
          message: 'Inventory inbound completed',
          warning: `Inventory updated, but location log failed: ${locationLogError.message}`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory inbound completed',
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Unexpected error') },
      { status: 500 }
    )
  }
}
