import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const orderId = body.orderId as string
    const customerName = body.customerName as string
    const address = body.address as string
    const note = body.note as string

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || 'Order not found' },
        { status: 404 }
      )
    }

    if (order.status === 'completed') {
      return NextResponse.json(
        { error: '已完成订单不能修改订单信息' },
        { status: 400 }
      )
    }

    if (order.status === 'cancelled') {
      return NextResponse.json(
        { error: '已取消订单不能修改订单信息' },
        { status: 400 }
      )
    }

    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update({
        customer_name: customerName?.trim() || null,
        address: address?.trim() || null,
        note: note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, order_no, customer_name, address, note, status')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}