import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

    const { error } = await supabaseAdmin.rpc('save_picking_edit', {
      p_order_id: orderId,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Picking edit saved',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}