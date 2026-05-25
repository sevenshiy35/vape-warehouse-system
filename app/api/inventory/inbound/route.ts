import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const productId = body.productId as string
    const qty = Number(body.qty)
    const shelfLocation = body.shelfLocation as string | null
    const operator = (body.operator as string) || 'admin'

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

    const { error } = await supabaseAdmin.rpc('inbound_inventory', {
      p_product_id: productId,
      p_qty: qty,
      p_shelf_location: shelfLocation || null,
      p_operator: operator,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
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
