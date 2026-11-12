import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isWarehouseAdmin } from "@/lib/warehouseAuth";

export const runtime = "nodejs";
const uuid = z.string().uuid();
const integer = z.number().int().min(0).max(10000000);
const stock = z.object({
  productId: uuid,
  location: z.string().trim().min(1).max(60),
  quantity: integer,
  mode: z.enum(["set", "add"]),
  position: z.number().int().min(1).max(3).optional(),
  note: z.string().max(500).optional(),
});
const schemas = {
  stock,
  import_stock: z.object({ rows: z.array(stock).min(1).max(1000) }),
  reorder_locations: z.object({
    productId: uuid,
    locations: z.array(z.string().trim().min(1).max(60)).max(3),
  }),
  ready: z.object({ orderId: uuid }),
  review: z.object({ orderId: uuid }),
  cancel_order: z.object({ orderId: uuid }),
  create_batch: z.object({
    orderIds: z.array(uuid).min(1).max(300),
    requestId: uuid,
    name: z.string().trim().min(1).max(100),
    date: z.iso.date(),
  }),
  pick: z.object({ lineId: uuid, quantity: integer }),
  start_packing: z.object({ batchId: uuid }),
  close_batch: z.object({ batchId: uuid }),
  pack: z.object({
    orderId: uuid,
    checkedItemIds: z.array(uuid).min(1).max(1000),
  }),
};
export async function POST(request: Request) {
  if (!(await isWarehouseAdmin()))
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "请求来源不正确" }, { status: 403 });
  try {
    const body = await request.json();
    if (!(body.action in schemas))
      return NextResponse.json({ error: "操作无效" }, { status: 400 });
    const payload = schemas[body.action as keyof typeof schemas].parse(
      body.payload,
    );
    const { data, error } = await supabaseAdmin.rpc("warehouse_command", {
      p_action: body.action,
      p_payload: payload,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "输入内容不完整或数量格式错误"
            : "请求失败，请刷新后重试",
      },
      { status: 400 },
    );
  }
}
