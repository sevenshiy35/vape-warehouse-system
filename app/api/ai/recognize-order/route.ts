import { NextResponse } from 'next/server'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { openai } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'

const RecognizedOrderSchema = z.object({
  items: z.array(
    z.object({
      rawText: z.string(),
      displayName: z.string(),
      quantity: z.number().int(),
      unit: z.enum(['支', '盒', '条', '个', '未知']),
      confidence: z.number(),
    })
  ),
  warnings: z.array(z.string()),
})

type RecognizedItem = z.infer<typeof RecognizedOrderSchema>['items'][number]

type ProductRow = {
  id: string
  sku: string
  brand: string | null
  product_name_cn: string | null
  product_name_en: string | null
  display_name: string | null
  inventory:
    | {
        shelf_location: string | null
        quantity_on_hand: number | null
      }
    | {
        shelf_location: string | null
        quantity_on_hand: number | null
      }[]
    | null
}

type OrderRecognitionContent =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'image_url'
      image_url: {
        url: string
        detail: 'high'
      }
    }

function getMimeType(path: string, fallback?: string) {
  if (fallback && fallback !== 'application/octet-stream') {
    return fallback
  }

  const lower = path.toLowerCase()

  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'

  return 'image/jpeg'
}

function stripEmoji(value: string | null | undefined) {
  return String(value || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/\u200D/g, '')
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')
}

function normalizeText(value: string | null | undefined) {
  return stripEmoji(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactText(value: string | null | undefined) {
  return normalizeText(value).replace(/\s+/g, '')
}

function getTokens(value: string | null | undefined) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function getInventory(product: ProductRow) {
  if (Array.isArray(product.inventory)) {
    return product.inventory[0] || null
  }

  return product.inventory || null
}

function scoreProductByDisplayName(item: RecognizedItem, product: ProductRow) {
  const rawText = normalizeText(item.rawText)
  const aiDisplayName = normalizeText(item.displayName)

  const rawCompact = compactText(item.rawText)
  const aiCompact = compactText(item.displayName)

  const productDisplay = normalizeText(product.display_name)
  const productDisplayCompact = compactText(product.display_name)

  const sku = normalizeText(product.sku)
  const brand = normalizeText(product.brand)

  const cnCompact = compactText(product.product_name_cn)
  const enCompact = compactText(product.product_name_en)

  let score = 0
  const reasons: string[] = []

  if (productDisplay && aiDisplayName && productDisplay === aiDisplayName) {
    score += 140
    reasons.push('display_name完全匹配')
  }

  if (
    productDisplayCompact &&
    aiCompact &&
    productDisplayCompact === aiCompact
  ) {
    score += 130
    reasons.push('display_name去空格完全匹配')
  }

  if (
    productDisplayCompact &&
    rawCompact &&
    rawCompact.includes(productDisplayCompact)
  ) {
    score += 115
    reasons.push('图片原文包含display_name')
  }

  if (
    productDisplayCompact &&
    aiCompact &&
    aiCompact.includes(productDisplayCompact)
  ) {
    score += 100
    reasons.push('AI识别名包含display_name')
  }

  if (
    productDisplayCompact &&
    aiCompact &&
    productDisplayCompact.includes(aiCompact)
  ) {
    score += 85
    reasons.push('display_name包含AI识别名')
  }

  if (sku && rawText.includes(sku)) {
    score += 100
    reasons.push('SKU匹配')
  }

  if (cnCompact && rawCompact.includes(cnCompact)) {
    score += 70
    reasons.push('中文名匹配')
  }

  if (enCompact && rawCompact.includes(enCompact)) {
    score += 70
    reasons.push('英文名匹配')
  }

  if (cnCompact && aiCompact && cnCompact.includes(aiCompact)) {
    score += 45
    reasons.push('AI识别名接近中文名')
  }

  if (enCompact && aiCompact && enCompact.includes(aiCompact)) {
    score += 45
    reasons.push('AI识别名接近英文名')
  }

  if (brand && rawText.includes(brand)) {
    score += 20
    reasons.push('品牌出现在图片原文')
  }

  const queryTokens = getTokens(`${item.rawText} ${item.displayName}`)
  const productTokens = getTokens(
    `${product.display_name || ''} ${product.product_name_en || ''} ${
      product.product_name_cn || ''
    }`
  )

  if (queryTokens.length > 0 && productTokens.length > 0) {
    const overlap = queryTokens.filter((token) => productTokens.includes(token))
    const overlapScore = Math.round((overlap.length / queryTokens.length) * 30)

    if (overlapScore > 0) {
      score += overlapScore
      reasons.push('关键词重合')
    }
  }

  return {
    score,
    reason: reasons.join('，') || '相似度不足',
  }
}

function matchOneItem(item: RecognizedItem, products: ProductRow[]) {
  const scored = products
    .map((product) => {
      const result = scoreProductByDisplayName(item, product)
      const inv = getInventory(product)

      return {
        product,
        score: result.score,
        reason: result.reason,
        shelf_location: inv?.shelf_location || null,
        quantity_on_hand: inv?.quantity_on_hand ?? null,
      }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  const second = scored[1]

  if (!best || best.score < 60) {
    return {
      rawText: item.rawText,
      brand: null,
      productName: item.displayName,
      quantity: item.quantity,
      unit: item.unit,
      confidence: item.confidence,
      note: null,

      matchStatus: 'not_found',
      matchScore: best?.score || 0,
      matchReason: '没有找到足够相似的display_name',
      productId: null,
      sku: null,
      matchedBrand: null,
      productNameCN: null,
      productNameEN: null,
      displayName: null,
      shelfLocation: null,
      currentStock: null,
      secondChoice: second
        ? {
            sku: second.product.sku,
            name:
              second.product.display_name ||
              second.product.product_name_cn ||
              second.product.product_name_en,
            score: second.score,
          }
        : null,
    }
  }

  const isConfident =
    best.score >= 95 ||
    (best.score >= 75 && (!second || best.score - second.score >= 15))

  const matchStatus = isConfident ? 'matched' : 'need_review'

  return {
    rawText: item.rawText,
    brand: best.product.brand,
    productName: item.displayName,
    quantity: item.quantity,
    unit: item.unit,
    confidence: item.confidence,
    note: null,

    matchStatus,
    matchScore: best.score,
    matchReason:
      matchStatus === 'matched'
        ? best.reason
        : `需要人工确认：${best.reason}`,
    productId: best.product.id,
    sku: best.product.sku,
    matchedBrand: best.product.brand,
    productNameCN: best.product.product_name_cn,
    productNameEN: best.product.product_name_en,
    displayName: best.product.display_name,
    shelfLocation: best.shelf_location,
    currentStock: best.quantity_on_hand,
    secondChoice: second
      ? {
          sku: second.product.sku,
          name:
            second.product.display_name ||
            second.product.product_name_cn ||
            second.product.product_name_en,
          score: second.score,
        }
      : null,
  }
}

async function downloadImageAsDataUrl(imagePath: string) {
  const { data: imageBlob, error: downloadError } = await supabaseAdmin.storage
    .from('order-images')
    .download(imagePath)

  if (downloadError || !imageBlob) {
    throw new Error(downloadError?.message || `下载图片失败：${imagePath}`)
  }

  const arrayBuffer = await imageBlob.arrayBuffer()
  const base64Image = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = getMimeType(imagePath, imageBlob.type)

  return `data:${mimeType};base64,${base64Image}`
}

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

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_no, image_path, image_paths')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || 'Order not found' },
        { status: 404 }
      )
    }

    const imagePaths =
      Array.isArray(order.image_paths) && order.image_paths.length > 0
        ? order.image_paths.filter(Boolean)
        : order.image_path
        ? [order.image_path]
        : []

    if (imagePaths.length === 0) {
      return NextResponse.json(
        { error: '这个订单没有上传截图' },
        { status: 400 }
      )
    }

    if (imagePaths.length > 5) {
      return NextResponse.json(
        { error: '一单最多建议识别 5 张截图，请减少截图数量后再试' },
        { status: 400 }
      )
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        sku,
        brand,
        product_name_cn,
        product_name_en,
        display_name,
        inventory (
          shelf_location,
          quantity_on_hand
        )
      `)
      .eq('is_active', true)

    if (productsError) {
      return NextResponse.json(
        { error: productsError.message },
        { status: 400 }
      )
    }

    const imageDataUrls = await Promise.all(
      imagePaths.map((imagePath) => downloadImageAsDataUrl(imagePath))
    )

    const userContent: OrderRecognitionContent[] = [
      {
        type: 'text',
        text: `
识别这个订单的所有截图中的商品。
这些图片都属于同一个订单。
每个商品返回 rawText、displayName、quantity、unit、confidence。

要求：
1. displayName 尽量只保留商品文字，去掉末尾表情符号。
2. 不要识别地址、电话、价格、配送费。
3. 如果同一个商品在多张图里重复出现，只保留一次，不要重复计算。
4. 如果两张图是不同商品列表，合并输出所有商品。
5. Yohuu烟弹如果显示1盒，quantity=1，unit=盒，不要换算。
6. 真烟displayName含“整条”：quantity=条数，unit=条；1条=10包由系统换算。
7. Price x qty: 14x5, $14 x 5, ¥14*5 => quantity=5. Prefer x5/×5/qty5/5支/5盒/5条. Never use price, total, shipping, phone, address as quantity.
        `.trim(),
      },
    ]

    imageDataUrls.forEach((url, index) => {
      userContent.push({
        type: 'text',
        text: `订单截图 ${index + 1}`,
      })

      userContent.push({
        type: 'image_url',
        image_url: {
          url,
          detail: 'high',
        },
      })
    })

    const completion = await openai.chat.completions.parse({
      model: 'gpt-4.1-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            '你是订单截图商品识别助手。只识别商品名称、数量、单位。商品名称优先输出图片里显示的品名，也就是仓库系统 display_name 对应的名字。不要解释，只返回结构化结果。',
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      response_format: zodResponseFormat(
        RecognizedOrderSchema,
        'recognized_order'
      ),
    })

    const parsed = completion.choices[0]?.message?.parsed

    if (!parsed) {
      return NextResponse.json(
        { error: 'AI没有返回可解析结果' },
        { status: 500 }
      )
    }

    const matchedItems = parsed.items.map((item) =>
      matchOneItem(item, (products || []) as ProductRow[])
    )

    const matchWarnings = matchedItems
      .filter((item) => item.matchStatus !== 'matched')
      .map((item) => `${item.rawText}：${item.matchReason}`)

    const result = {
      items: matchedItems,
      warnings: [...parsed.warnings, ...matchWarnings],
      imageCount: imagePaths.length,
      imagePaths,
    }

    await supabaseAdmin
      .from('orders')
      .update({
        ai_raw_result: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    return NextResponse.json({
      success: true,
      orderNo: order.order_no,
      result,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, 'AI识别失败'),
      },
      { status: 500 }
    )
  }
}
