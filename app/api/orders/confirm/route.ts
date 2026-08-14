import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orderId = body.orderId as string

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      )
    }

    let { error } = await supabaseAdmin.rpc(
      'confirm_order_and_defer_location',
      {
        p_order_id: orderId,
      }
    )

    if (error?.code === 'PGRST202') {
      const fallback = await supabaseAdmin.rpc('confirm_order_and_deduct', {
        p_order_id: orderId,
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
      message: 'Order confirmed and inventory deducted',
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Unexpected error') },
      { status: 500 }
    )
  }
}
