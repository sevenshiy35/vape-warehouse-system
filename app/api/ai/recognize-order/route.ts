import { NextResponse } from 'next/server'
import {
  OrderRecognitionError,
  recognizeOrder,
} from '@/lib/orderRecognition'
import { getErrorMessage } from '@/lib/errors'
import { isWarehouseAdmin } from '@/lib/warehouseAuth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!(await isWarehouseAdmin())) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  try {
    const body = await request.json()
    const orderId = body.orderId as string
    const force = body.force === true

    const recognition = await recognizeOrder(orderId, { force })

    return NextResponse.json({
      success: true,
      orderNo: recognition.orderNo,
      result: recognition.result,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, 'AI recognition failed'),
      },
      {
        status: error instanceof OrderRecognitionError ? error.status : 500,
      }
    )
  }
}
