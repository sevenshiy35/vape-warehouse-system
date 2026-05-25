import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

function toOptionalInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  const num = Number(value)

  if (!Number.isInteger(num)) {
    return null
  }

  return num
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const sku = String(body.sku || '').trim()
    const brand = String(body.brand || '').trim()
    const productNameCN = String(body.productNameCN || '').trim()
    const displayName = String(body.displayName || '').trim()
    const productNameEN = String(body.productNameEN || '').trim()
    const category = String(body.category || '').trim()
    const sourceSheet = String(body.sourceSheet || '').trim()
    const shelfLocation = String(body.shelfLocation || '').trim()
    const operator = String(body.operator || 'admin').trim()

    const initialQty = Number(body.initialQty || 0)
    const looseQuantity = toOptionalInteger(body.looseQuantity)
    const boxQuantity = toOptionalInteger(body.boxQuantity)
    const lowStockThreshold = Number(body.lowStockThreshold || 3)

    if (!brand) {
      return NextResponse.json(
        { error: 'Missing brand' },
        { status: 400 }
      )
    }

    if (!productNameCN) {
      return NextResponse.json(
        { error: 'Missing Chinese product name' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(initialQty) || initialQty < 0) {
      return NextResponse.json(
        { error: 'Initial quantity must be 0 or greater' },
        { status: 400 }
      )
    }

    if (initialQty > 0 && !shelfLocation) {
      return NextResponse.json(
        { error: 'Shelf location is required when initial quantity is greater than 0' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      return NextResponse.json(
        { error: 'Low stock threshold must be 0 or greater' },
        { status: 400 }
      )
    }

    const { data: productId, error } = await supabaseAdmin.rpc(
      'create_product_with_inventory',
      {
        p_sku: sku || null,
        p_brand: brand,
        p_product_name_cn: productNameCN,
        p_display_name: displayName || null,
        p_product_name_en: productNameEN || null,
        p_category: category || null,
        p_source_sheet: sourceSheet || brand,
        p_initial_qty: initialQty,
        p_shelf_location: shelfLocation || null,
        p_loose_quantity: looseQuantity,
        p_box_quantity: boxQuantity,
        p_low_stock_threshold: lowStockThreshold,
        p_operator: operator || 'admin',
      }
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        sku,
        brand,
        source_sheet,
        product_name_cn,
        display_name,
        product_name_en,
        category,
        inventory (
          shelf_location,
          quantity_on_hand,
          loose_quantity,
          box_quantity,
          low_stock_threshold
        )
      `)
      .eq('id', productId)
      .single()

    if (productError) {
      return NextResponse.json({
        success: true,
        productId,
      })
    }

    return NextResponse.json({
      success: true,
      product,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Unexpected error') },
      { status: 500 }
    )
  }
}
