import 'dotenv/config'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config({ path: '.env.local' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'inventory.xlsm')

const BRAND_SHEETS = [
  'SP',
  'IceBomb',
  'Umi',
  'Relx三颗装',
  '烟杆',
  'Yohuu',
  'Yohuu烟弹',
  'BBmon',
  '真烟',
]

function cleanText(value) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return 0
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function getValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key]
    }
  }
  return null
}

function getBrandFromSheet(sheetName) {
  if (sheetName === 'Relx三颗装') return 'Relx三颗装'
  if (sheetName === 'Yohuu烟弹') return 'Yohuu烟弹'
  return sheetName
}

function getDefaultPickMultiplier(brand) {
  if (brand === 'Yohuu烟弹') return 3
  return null
}

async function importInventory() {
  console.log('Reading Excel:', EXCEL_PATH)

  const workbook = XLSX.readFile(EXCEL_PATH, {
    cellDates: true,
  })

  let totalImported = 0
  let skippedRows = 0

  for (const sheetName of BRAND_SHEETS) {
    const worksheet = workbook.Sheets[sheetName]

    if (!worksheet) {
      console.log(`Skip missing sheet: ${sheetName}`)
      continue
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
    })

    console.log(`\nSheet: ${sheetName}, rows: ${rows.length}`)

    for (const row of rows) {
      const sku = cleanText(
        getValue(row, ['SKU', 'sku', 'Sku'])
      )

      const productNameCN = cleanText(
        getValue(row, ['库存品名', '中文名', '品名', 'Name'])
      )

      const displayName = cleanText(
        getValue(row, ['展示品名', '显示品名', 'DisplayName'])
      )

      const productNameEN = cleanText(
        getValue(row, ['英文', '英文名', 'English', 'product_name_en'])
      )

      const shelfLocation = cleanText(
        getValue(row, ['库存位置', '库位', 'Location', 'shelf_location'])
      )

      const normalQty = toNumber(
        getValue(row, ['库存数量', '数量', 'stock_quantity'])
      )

      const totalQty = toNumber(
        getValue(row, ['总计库存', 'total_quantity'])
      )

      if (!sku || !productNameCN) {
        skippedRows += 1
        continue
      }

      const brand = getBrandFromSheet(sheetName)
      const defaultPickMultiplier = getDefaultPickMultiplier(brand)

      let quantityOnHand = normalQty

      // Relx 三颗装特殊规则：
      // 如果有“总计库存”，用总计库存作为实际可用库存。
      if (sheetName === 'Relx三颗装') {
        quantityOnHand = totalQty > 0 ? totalQty : normalQty
      }

      // 如果库存为 0，自动清空库位
      const finalShelfLocation =
        quantityOnHand === 0 ? null : shelfLocation

      const productPayload = {
        sku,
        brand,
        product_name_cn: productNameCN,
        display_name: displayName,
        product_name_en: productNameEN,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      if (defaultPickMultiplier) {
        productPayload.default_pick_multiplier = defaultPickMultiplier
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .upsert(
          productPayload,
          {
            onConflict: 'sku',
          }
        )
        .select('id, sku')
        .single()

      if (productError) {
        console.error('Product upsert failed:', {
          sheetName,
          sku,
          error: productError.message,
        })
        continue
      }

      const { error: inventoryError } = await supabase
        .from('inventory')
        .upsert(
          {
            product_id: product.id,
            shelf_location: finalShelfLocation,
            quantity_on_hand: quantityOnHand,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'product_id',
          }
        )

      if (inventoryError) {
        console.error('Inventory upsert failed:', {
          sheetName,
          sku,
          error: inventoryError.message,
        })
        continue
      }

      totalImported += 1
    }
  }

  console.log('\nImport finished.')
  console.log('Imported rows:', totalImported)
  console.log('Skipped rows:', skippedRows)
}

importInventory().catch((error) => {
  console.error(error)
  process.exit(1)
})
