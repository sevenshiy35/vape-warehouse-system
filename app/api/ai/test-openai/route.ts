import { NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const response = await openai.responses.create({
      model: 'gpt-5.4',
      input: 'Say OpenAI API connected successfully in one short sentence.',
    })

    return NextResponse.json({
      success: true,
      message: response.output_text,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'OpenAI API test failed',
      },
      { status: 500 }
    )
  }
}