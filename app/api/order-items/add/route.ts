import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const orderId = body.orderId as string
    const productId = body.productId as string
    const qty = Number(body.qty)
    const unit = (body.unit as string) || '支'

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      )
    }

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      )
    }

    if (!qty || qty <= 0) {
      return NextResponse.json(
        { error: 'Invalid quantity' },
        { status: 400 }
      )
    }

    const { data: itemId, error } = await supabaseAdmin.rpc(
      'add_order_item_safe',
      {
        p_order_id: orderId,
        p_product_id: productId,
        p_qty: qty,
        p_unit: unit,
      }
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      itemId,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}