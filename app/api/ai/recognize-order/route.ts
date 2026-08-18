import { NextResponse } from 'next/server'
import {
  OrderRecognitionError,
  recognizeOrder,
} from '@/lib/orderRecognition'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
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
