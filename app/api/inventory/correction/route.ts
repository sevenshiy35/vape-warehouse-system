import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const productId = body.productId as string
    const actualQty = Number(body.actualQty)
    const shelfLocation = body.shelfLocation as string | null
    const operator = (body.operator as string) || 'admin'
    const reason = (body.reason as string) || 'Inventory correction'

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(actualQty) || actualQty < 0) {
      return NextResponse.json(
        { error: 'Actual quantity must be 0 or greater' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin.rpc('correct_inventory', {
      p_product_id: productId,
      p_actual_qty: actualQty,
      p_shelf_location: shelfLocation || null,
      p_operator: operator,
      p_reason: reason,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory correction completed',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}