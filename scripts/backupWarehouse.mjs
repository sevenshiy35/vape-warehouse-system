import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const directory = `backups/pre-v2-${new Date().toISOString().replace(/[:.]/g, '-')}`
await fs.mkdir(directory, { recursive: true })
const counts = {}
for (const table of ['products', 'inventory', 'orders', 'order_items', 'product_brands', 'order_counters', 'inventory_bins', 'pick_batches', 'batch_orders', 'batch_lines', 'warehouse_events', 'warehouse_settings']) {
  const rows = []
  for (let start = 0; ; start += 500) {
    let query = db.from(table).select('*').order(table === 'inventory' ? 'product_id' : table === 'product_brands' ? 'brand_name' : table === 'order_counters' ? 'order_date' : table === 'batch_orders' ? 'batch_id' : 'id')
    if (table === 'batch_orders') query = query.order('order_id')
    const { data, error } = await query.range(start, start + 499)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 500) break
  }
  await fs.writeFile(`${directory}/${table}.json`, JSON.stringify(rows, null, 2))
  const check = JSON.parse(await fs.readFile(`${directory}/${table}.json`, 'utf8'))
  if (check.length !== rows.length) throw new Error('Backup verification failed')
  counts[table] = rows.length
}
await fs.writeFile(`${directory}/manifest.json`, JSON.stringify({ project: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, created_at: new Date().toISOString(), counts }, null, 2))
console.log(JSON.stringify({ directory, counts }))
