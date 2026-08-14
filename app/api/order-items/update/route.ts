import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const itemId = body.itemId as string
    const qty = Number(body.qty)
    const unit = (body.unit as string) || '支'

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId' },
        { status: 400 }
      )
    }

    if (!qty || qty <= 0) {
      return NextResponse.json(
        { error: 'Invalid quantity' },
        { status: 400 }
      )
    }

    let { error } = await supabaseAdmin.rpc(
      'update_order_item_deferred_location',
      {
        p_item_id: itemId,
        p_qty: qty,
        p_unit: unit,
      }
    )

    if (error?.code === 'PGRST202') {
      const fallback = await supabaseAdmin.rpc('update_order_item_safe', {
        p_item_id: itemId,
        p_qty: qty,
        p_unit: unit,
      })
      error = fallback.error
    }

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Unexpected error') },
      { status: 500 }
    )
  }
}
