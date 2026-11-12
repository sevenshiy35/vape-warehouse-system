import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isWarehouseAdmin } from "@/lib/warehouseAuth";
export async function POST(request: Request) {
  if (!(await isWarehouseAdmin()))
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "请求来源不正确" }, { status: 403 });
  try {
    const payload = z
      .object({
        sku: z.string().trim().max(60),
        brand: z.string().trim().min(1).max(100),
        productNameCN: z.string().trim().min(1).max(200),
        displayName: z.string().trim().max(200),
        productNameEN: z.string().trim().max(200),
        boxMultiplier: z.number().int().min(1).max(10000),
        cartonMultiplier: z.number().int().min(1).max(10000),
      })
      .parse(await request.json());
    const { data, error } = await supabaseAdmin.rpc(
      "warehouse_create_product",
      { p_payload: payload },
    );
    if (error)
      return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ success: true, productId: data });
  } catch {
    return NextResponse.json(
      { error: "请检查商品名称、品牌及换算数量" },
      { status: 400 },
    );
  }
}
