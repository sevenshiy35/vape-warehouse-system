import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_no, status, created_at')
      .limit(1)

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: 'Supabase connected, but query failed',
          error: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Next.js connected to Supabase successfully',
      data,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: 'Connection test failed',
        error: getErrorMessage(error, 'Connection test failed'),
      },
      { status: 500 }
    )
  }
}
