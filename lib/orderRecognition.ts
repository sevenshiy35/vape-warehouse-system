import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { openai } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getErrorMessage } from '@/lib/errors'

const RECOGNIZED_UNITS = [
  '\u652f',
  '\u76d2',
  '\u6761',
  '\u4e2a',
  '\u672a\u77e5',
] as const

const UNIT_PIECE = RECOGNIZED_UNITS[0]
const UNIT_BOX = RECOGNIZED_UNITS[1]
const UNIT_CARTON = RECOGNIZED_UNITS[2]
const UNIT_UNKNOWN = RECOGNIZED_UNITS[4]
const TOBACCO_BRAND = '\u771f\u70df'

const RecognizedOrderSchema = z.object({
  items: z.array(
    z.object({
      rawText: z.string(),
      displayName: z.string(),
      quantity: z.number().int(),
      unit: z.enum(RECOGNIZED_UNITS),
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

type MatchedOrderItem = {
  rawText: string
  brand: string | null
  productName: string
  quantity: number
  unit: RecognizedItem['unit']
  confidence: number
  note: string | null
  matchStatus: 'matched' | 'need_review' | 'not_found'
  matchScore: number
  matchReason: string
  productId: string | null
  sku: string | null
  matchedBrand: string | null
  productNameCN: string | null
  productNameEN: string | null
  displayName: string | null
  shelfLocation: string | null
  currentStock: number | null
  secondChoice: {
    sku: string
    name: string | null
    score: number
  } | null
}

export type AutoAddSummary = {
  attempted: number
  added: number
  skipped: number
  failed: number
  errors: string[]
}

export type OrderRecognitionResult = {
  items: MatchedOrderItem[]
  warnings: string[]
  imageCount: number
  imagePaths: string[]
  status?: 'processing' | 'completed' | 'failed'
  autoAdd?: AutoAddSummary
  error?: string
}

type AiStatus = 'not_started' | 'processing' | 'completed' | 'failed'

export class OrderRecognitionError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'OrderRecognitionError'
    this.status = status
  }
}

const blockedRecognitionStatuses = new Set([
  'picking',
  'completed',
  'cancelled',
])

export function getBlockedRecognitionMessage(status: string) {
  if (status === 'picking') return 'Picking orders cannot use AI recognition'
  if (status === 'completed') return 'Completed orders cannot use AI recognition'
  if (status === 'cancelled') return 'Cancelled orders cannot use AI recognition'
  return 'Current order status cannot use AI recognition'
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

function normalizeKnownOcrAliases(value: string) {
  return value
    .replace(/\u714c\u8d6b\u95e8/g, '\u714a\u8d6b\u95e8')
    .replace(/\u5341\u4e8c[\u6743\u6748]/g, '\u5341\u4e8c\u9497')
    .replace(/\u83e0\u841d\u521b\u51b0/g, '\u83e0\u841d\u5228\u51b0')
}

function stripTobaccoUnitPrefix(value: string) {
  return value
    .replace(
      /^\s*(?:\u5355\u5305|\u4e00\u5305|\u6574\u6761|\u4e00\u6761)\s*/u,
      ''
    )
    .trim()
}

function normalizeTobaccoUnit(
  item: RecognizedItem,
  brand: string | null
): RecognizedItem['unit'] {
  if (brand?.trim() !== TOBACCO_BRAND) return item.unit

  const rawText = normalizeKnownOcrAliases(stripEmoji(item.rawText))

  if (/^\s*(?:\u6574\u6761|\u4e00\u6761|[1-9]\d*\s*\u6761)/u.test(rawText)) {
    return UNIT_CARTON
  }

  if (/^\s*(?:\u5355\u5305|\u4e00\u5305|[1-9]\d*\s*\u5305)/u.test(rawText)) {
    return UNIT_PIECE
  }

  return item.unit
}

function normalizeRecognitionText(value: string | null | undefined) {
  return stripTobaccoUnitPrefix(normalizeKnownOcrAliases(stripEmoji(value)))
}

function normalizeText(value: string | null | undefined) {
  return normalizeKnownOcrAliases(stripEmoji(value))
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
  const itemRawText = normalizeRecognitionText(item.rawText)
  const itemDisplayName = normalizeRecognitionText(item.displayName)

  const rawText = normalizeText(itemRawText)
  const aiDisplayName = normalizeText(itemDisplayName)

  const rawCompact = compactText(itemRawText)
  const aiCompact = compactText(itemDisplayName)

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
    reasons.push('display_name exact match')
  }

  if (
    productDisplayCompact &&
    aiCompact &&
    productDisplayCompact === aiCompact
  ) {
    score += 130
    reasons.push('display_name compact exact match')
  }

  if (
    productDisplayCompact &&
    rawCompact &&
    rawCompact.includes(productDisplayCompact)
  ) {
    score += 115
    reasons.push('raw text contains display_name')
  }

  if (
    productDisplayCompact &&
    aiCompact &&
    aiCompact.includes(productDisplayCompact)
  ) {
    score += 100
    reasons.push('AI name contains display_name')
  }

  if (
    productDisplayCompact &&
    aiCompact &&
    productDisplayCompact.includes(aiCompact)
  ) {
    score += 85
    reasons.push('display_name contains AI name')
  }

  if (sku && rawText.includes(sku)) {
    score += 100
    reasons.push('SKU match')
  }

  if (cnCompact && rawCompact.includes(cnCompact)) {
    score += 70
    reasons.push('Chinese name match')
  }

  if (enCompact && rawCompact.includes(enCompact)) {
    score += 70
    reasons.push('English name match')
  }

  if (cnCompact && aiCompact && cnCompact.includes(aiCompact)) {
    score += 45
    reasons.push('AI name close to Chinese name')
  }

  if (enCompact && aiCompact && enCompact.includes(aiCompact)) {
    score += 45
    reasons.push('AI name close to English name')
  }

  if (brand && rawText.includes(brand)) {
    score += 20
    reasons.push('brand appears in raw text')
  }

  const queryTokens = getTokens(`${itemRawText} ${itemDisplayName}`)
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
      reasons.push('keyword overlap')
    }
  }

  return {
    score,
    reason: reasons.join(', ') || 'low similarity',
  }
}

function matchOneItem(
  item: RecognizedItem,
  products: ProductRow[]
): MatchedOrderItem {
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
      matchReason: 'No close display_name match',
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
    unit: normalizeTobaccoUnit(item, best.product.brand),
    confidence: item.confidence,
    note: null,
    matchStatus,
    matchScore: best.score,
    matchReason:
      matchStatus === 'matched'
        ? best.reason
        : `Needs review: ${best.reason}`,
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
    throw new OrderRecognitionError(
      downloadError?.message || `Failed to download image: ${imagePath}`,
      400
    )
  }

  const arrayBuffer = await imageBlob.arrayBuffer()
  const base64Image = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = getMimeType(imagePath, imageBlob.type)

  return `data:${mimeType};base64,${base64Image}`
}

async function updateOrderAiResult(
  orderId: string,
  aiRawResult: OrderRecognitionResult | Record<string, unknown>,
  options: {
    aiStatus?: AiStatus
    aiError?: string | null
    aiProcessedAt?: string | null
  } = {}
) {
  const updatePayload: Record<string, unknown> = {
    ai_raw_result: aiRawResult,
    updated_at: new Date().toISOString(),
  }

  if (options.aiStatus !== undefined) {
    updatePayload.ai_status = options.aiStatus
  }

  if (options.aiError !== undefined) {
    updatePayload.ai_error = options.aiError
  }

  if (options.aiProcessedAt !== undefined) {
    updatePayload.ai_processed_at = options.aiProcessedAt
  }

  await supabaseAdmin
    .from('orders')
    .update(updatePayload)
    .eq('id', orderId)
}

export async function recognizeOrder(
  orderId: string,
  options: {
    ignoreAiStatus?: boolean
  } = {}
) {
  if (!orderId) {
    throw new OrderRecognitionError('Missing orderId', 400)
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select(
      'id, order_no, status, image_path, image_paths, ai_status, ai_raw_result'
    )
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new OrderRecognitionError(
      orderError?.message || 'Order not found',
      404
    )
  }

  if (blockedRecognitionStatuses.has(order.status)) {
    throw new OrderRecognitionError(
      getBlockedRecognitionMessage(order.status),
      400
    )
  }

  if (!options.ignoreAiStatus) {
    if (order.ai_status === 'processing') {
      throw new OrderRecognitionError('AI recognition is already running', 409)
    }

    if (order.ai_status === 'completed' && order.ai_raw_result) {
      return {
        orderNo: order.order_no,
        result: order.ai_raw_result as OrderRecognitionResult,
        cached: true,
      }
    }
  }

  const imagePaths =
    Array.isArray(order.image_paths) && order.image_paths.length > 0
      ? order.image_paths.filter(Boolean)
      : order.image_path
      ? [order.image_path]
      : []

  if (imagePaths.length === 0) {
    throw new OrderRecognitionError('This order has no images', 400)
  }

  if (imagePaths.length > 5) {
    throw new OrderRecognitionError(
      'A single order can recognize up to 5 screenshots',
      400
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
    throw new OrderRecognitionError(productsError.message, 400)
  }

  const imageDataUrls = await Promise.all(
    imagePaths.map((imagePath) => downloadImageAsDataUrl(imagePath))
  )

  const userContent: OrderRecognitionContent[] = [
    {
      type: 'text',
      text: `
Recognize all product lines in this order's screenshots. All screenshots belong to the same order.
Return rawText, displayName, quantity, unit, confidence for each product.
Unit must be one of: ${UNIT_PIECE}, ${UNIT_BOX}, ${UNIT_CARTON}, \u4e2a, ${UNIT_UNKNOWN}.
Rules:
1. displayName should keep product text only and remove trailing emoji.
2. Ignore address, phone, price, total, delivery fee, and shipping.
3. If the same product appears in multiple screenshots, keep it once.
4. If screenshots contain different product lists, merge all products.
5. For Yohuu pods, if the image says 1${UNIT_BOX}, return quantity=1 and unit=${UNIT_BOX}; do not convert.
6. For tobacco, \u5355\u5305/\u4e00\u5305 only means unit=${UNIT_PIECE}; remove it from displayName. \u6574\u6761/\u4e00\u6761 means unit=${UNIT_CARTON}; remove it from displayName.
7. Tobacco OCR hints: \u714c\u8d6b\u95e8=\u714a\u8d6b\u95e8, \u5341\u4e8c\u6743/\u5341\u4e8c\u6748=\u5341\u4e8c\u9497.
8. RELX OCR hint: \u83e0\u841d\u521b\u51b0=\u83e0\u841d\u5228\u51b0. Treat Relx \u52a0\u6d53\u7248\u83e0\u841d\u521b\u51b0 as Relx \u52a0\u6d53\u7248\u83e0\u841d\u5228\u51b0, not \u9178\u751c\u83e0\u841d\u51b0\u6c99.
9. In price x qty lines, use the number after x/\u00d7/*: "18x2 ... $36" => quantity=2. Never use unit price, $/\u00a5 amount, or line total.
      `.trim(),
    },
  ]

  imageDataUrls.forEach((url, index) => {
    userContent.push({
      type: 'text',
      text: `Order screenshot ${index + 1}`,
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
          'You identify product names, quantities, and units from order screenshots. Prefer the product name as shown in the image and matching the warehouse display_name. Return structured data only.',
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
    throw new OrderRecognitionError('AI returned no parseable result', 500)
  }

  const matchedItems = parsed.items.map((item) =>
    matchOneItem(item, (products || []) as ProductRow[])
  )

  const matchWarnings = matchedItems
    .filter((item) => item.matchStatus !== 'matched')
    .map((item) => `${item.rawText}: ${item.matchReason}`)

  const result: OrderRecognitionResult = {
    status: 'completed',
    items: matchedItems,
    warnings: [...parsed.warnings, ...matchWarnings],
    imageCount: imagePaths.length,
    imagePaths,
  }

  await updateOrderAiResult(orderId, result, {
    aiStatus: 'completed',
    aiError: null,
    aiProcessedAt: new Date().toISOString(),
  })

  return {
    orderNo: order.order_no,
    result,
  }
}

export async function autoAddMatchedOrderItems(
  orderId: string,
  result: OrderRecognitionResult
): Promise<AutoAddSummary> {
  const matchedItems = result.items.filter(
    (item) => item.matchStatus === 'matched' && item.productId
  )

  const summary: AutoAddSummary = {
    attempted: matchedItems.length,
    added: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  if (matchedItems.length === 0) {
    return summary
  }

  const { data: existingItems, error: existingError } = await supabaseAdmin
    .from('order_items')
    .select('product_id')
    .eq('order_id', orderId)

  if (existingError) {
    throw new OrderRecognitionError(existingError.message, 400)
  }

  const existingProductIds = new Set(
    (existingItems || [])
      .map((item) => item.product_id)
      .filter((productId): productId is string => Boolean(productId))
  )

  for (const item of matchedItems) {
    if (!item.productId) continue

    if (existingProductIds.has(item.productId)) {
      summary.skipped += 1
      continue
    }

    const unit = item.unit === UNIT_UNKNOWN ? UNIT_PIECE : item.unit

    const { error } = await supabaseAdmin.rpc('add_order_item_safe', {
      p_order_id: orderId,
      p_product_id: item.productId,
      p_qty: item.quantity,
      p_unit: unit,
    })

    if (error) {
      summary.failed += 1
      summary.errors.push(`${item.rawText}: ${error.message}`)
      continue
    }

    existingProductIds.add(item.productId)
    summary.added += 1
  }

  return summary
}

export async function recognizeAndAutoAddOrder(orderId: string) {
  const processingResult = {
    status: 'processing',
    items: [],
    warnings: [],
    imageCount: 0,
    imagePaths: [],
  }

  const { data: claimedOrder, error: claimError } = await supabaseAdmin
    .from('orders')
    .update({
      ai_raw_result: processingResult,
      ai_status: 'processing',
      ai_error: null,
      ai_processed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('ai_status', 'not_started')
    .in('status', ['uploaded', 'need_review'])
    .select('id')
    .maybeSingle()

  if (claimError) {
    throw new OrderRecognitionError(claimError.message, 400)
  }

  if (!claimedOrder) {
    return {
      skipped: true,
      reason: 'AI recognition already started, completed, or order is locked',
    }
  }

  let lastRecognitionResult: OrderRecognitionResult | null = null

  try {
    const recognition = await recognizeOrder(orderId, {
      ignoreAiStatus: true,
    })
    lastRecognitionResult = recognition.result

    const { data: latestOrder, error: latestOrderError } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()

    if (latestOrderError || !latestOrder) {
      throw new OrderRecognitionError(
        latestOrderError?.message || 'Order not found',
        404
      )
    }

    if (!['uploaded', 'need_review'].includes(latestOrder.status)) {
      const autoAdd: AutoAddSummary = {
        attempted: 0,
        added: 0,
        skipped: 0,
        failed: 0,
        errors: [
          `Order status changed to ${latestOrder.status}; auto add skipped`,
        ],
      }
      const result: OrderRecognitionResult = {
        ...recognition.result,
        autoAdd,
      }

      await updateOrderAiResult(orderId, result, {
        aiStatus: 'completed',
        aiError: null,
        aiProcessedAt: new Date().toISOString(),
      })

      return {
        ...recognition,
        result,
        autoAdd,
      }
    }

    const autoAdd = await autoAddMatchedOrderItems(
      orderId,
      recognition.result
    )
    const result: OrderRecognitionResult = {
      ...recognition.result,
      autoAdd,
    }

    await supabaseAdmin
      .from('orders')
      .update({
        status: 'need_review',
        ai_raw_result: result,
        ai_status: 'completed',
        ai_error: null,
        ai_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    return {
      ...recognition,
      result,
      autoAdd,
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'AI recognition failed')
    const failedResult: OrderRecognitionResult = lastRecognitionResult
      ? {
          ...lastRecognitionResult,
          status: 'failed',
          error: message,
          warnings: [...lastRecognitionResult.warnings, message],
        }
      : {
          status: 'failed',
          error: message,
          items: [],
          warnings: [message],
          imageCount: 0,
          imagePaths: [],
        }

    const { data: currentOrder } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()

    const failureUpdate: Record<string, unknown> = {
      ai_status: 'failed',
      ai_error: message,
      ai_processed_at: new Date().toISOString(),
      ai_raw_result: failedResult,
      updated_at: new Date().toISOString(),
    }

    if (
      currentOrder &&
      ['uploaded', 'need_review'].includes(currentOrder.status)
    ) {
      failureUpdate.status = 'need_review'
    }

    await supabaseAdmin
      .from('orders')
      .update(failureUpdate)
      .eq('id', orderId)

    throw error
  }
}
