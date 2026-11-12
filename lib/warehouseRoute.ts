import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isWarehouseAdmin } from "./warehouseAuth";
import { supabaseAdmin } from "./supabaseAdmin";
export function warehouseRoute(action: string, item = false) {
  return async (request: Request) => {
    if (!(await isWarehouseAdmin()))
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return NextResponse.json({ error: "请求来源不正确" }, { status: 403 });
    try {
      const body = await request.json();
      const uuid = z.string().uuid();
      const schema = item
        ? action === "delete"
          ? z.object({ itemId: uuid })
          : z.object({
              ...(action === "add"
                ? { orderId: uuid, productId: uuid }
                : { itemId: uuid }),
              qty: z.number().int().positive().max(1000000),
              unit: z.enum(["支", "个", "盒", "条"]),
            })
        : z.object({ orderId: uuid });
      const payload = schema.parse(body);
      const { data, error } = await supabaseAdmin.rpc(
        item ? "warehouse_edit_item" : "warehouse_command",
        { p_action: action, p_payload: payload },
      );
      if (error)
        return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({
        success: true,
        itemId: item ? data : undefined,
      });
    } catch {
      return NextResponse.json(
        { error: "输入内容有误，请刷新后重试" },
        { status: 400 },
      );
    }
  };
}
