export type InventoryRecord = {
  shelf_location: string | null
  quantity_on_hand: number
  low_stock_threshold?: number | null
  updated_at?: string | null
}

export type ProductWithInventory = {
  id: string
  sku: string
  brand: string
  product_name_cn: string
  display_name: string | null
  product_name_en: string | null
  inventory?: InventoryRecord | InventoryRecord[] | null
}

export function getInventoryRecord(product: ProductWithInventory) {
  return Array.isArray(product.inventory)
    ? product.inventory[0] || null
    : product.inventory || null
}
