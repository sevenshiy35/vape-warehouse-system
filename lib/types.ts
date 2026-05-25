export type InventoryRecord = {
  shelf_location: string | null
  quantity_on_hand: number
  loose_quantity?: number | null
  box_quantity?: number | null
  low_stock_threshold?: number | null
  updated_at?: string | null
}

export type ProductWithInventory = {
  id: string
  sku: string
  brand: string
  source_sheet?: string | null
  product_name_cn: string
  display_name: string | null
  product_name_en: string | null
  category?: string | null
  inventory?: InventoryRecord | InventoryRecord[] | null
}

export function getInventoryRecord(product: ProductWithInventory) {
  return Array.isArray(product.inventory)
    ? product.inventory[0] || null
    : product.inventory || null
}
