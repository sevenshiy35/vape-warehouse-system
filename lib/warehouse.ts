export type WarehouseProduct = {
  id: string;
  sku: string;
  brand: string;
  product_name_cn: string;
  display_name: string | null;
  product_name_en?: string | null;
  default_pick_multiplier: number;
  carton_pick_multiplier: number;
};
export type WarehouseBin = {
  id: string;
  product_id: string;
  location: string;
  position: number | null;
  quantity: number;
  reserved: number;
};
export type WarehouseItem = {
  id: string;
  product_id: string;
  sku_snapshot: string;
  display_name_snapshot: string | null;
  product_name_cn_snapshot: string;
  recognized_qty: number;
  recognized_unit: string;
  pick_qty: number;
  packed_qty: number;
  match_status: string;
};
export type WarehouseOrder = {
  id: string;
  order_no: string;
  customer_name: string | null;
  address: string | null;
  note: string | null;
  status: string;
  business_date: string;
  batch_id: string | null;
  created_at: string;
  ai_status: string;
  order_items: WarehouseItem[];
};
export type WarehouseBatch = {
  id: string;
  name: string;
  business_date: string;
  status: string;
  created_at: string;
};
export type WarehouseLine = {
  id: string;
  batch_id: string;
  bin_id: string;
  product_id: string;
  location: string;
  position: number;
  requested: number;
  picked: number;
  confirmed: boolean;
  returned: number;
};
export const warehouseStatus: Record<string, string> = {
  uploaded: "已上传",
  need_review: "待审核",
  confirmed: "待拣货",
  picking: "集中拣货中",
  packing: "待分货打包",
  completed: "已完成",
  closed: "已退回结束",
  cancelled: "已取消",
};
export function easternToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
