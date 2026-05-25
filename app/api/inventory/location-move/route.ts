import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const productId = body.productId as string
    const newShelfLocation = String(body.newShelfLocation || '').trim()
    const operator = String(body.operator || 'admin').trim()
    const reason = String(body.reason || 'Location move').trim()

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      )
    }

    if (!newShelfLocation) {
      return NextResponse.json(
        { error: 'New shelf location is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin.rpc('move_inventory_location', {
      p_product_id: productId,
      p_new_shelf_location: newShelfLocation,
      p_operator: operator || 'admin',
      p_reason: reason || 'Location move',
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Location moved successfully',
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Unexpected error') },
      { status: 500 }
    )
  }
}
