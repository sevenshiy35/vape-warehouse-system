import Image from "next/image";
import Link from "next/link";
import { NavButton, PageShell, Panel } from "@/components/PageChrome";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatEasternTime } from "@/lib/time";
import styles from "./page.module.css";
import { isWarehouseAdmin } from "@/lib/warehouseAuth";

export const dynamic = "force-dynamic";

type WorkOrder = {
  id: string;
  order_no: string;
  address: string | null;
  batch_id: string | null;
  status: string;
  total_items: number | null;
  created_at: string | null;
};

type RecentLog = {
  id: string;
  sku_snapshot: string | null;
  product_name_snapshot: string | null;
  change_qty: number | null;
  log_type: string | null;
  created_at: string | null;
};

const quickActions = [
  {
    title: "盘点上架 / 补货",
    icon: "入",
    description: "按库位录入商品数量",
    href: "/admin/warehouse?tab=stock_ops",
    tone: "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950",
  },
  {
    title: "添加商品",
    icon: "添",
    description: "创建新 SKU 和商品资料",
    href: "/admin/products/new",
    tone: "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950",
  },
  {
    title: "分货打包",
    icon: "包",
    description: "集中拣完后，逐单核对打包",
    href: "/admin/warehouse?tab=batches",
    tone: "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950",
  },
  {
    title: "作业流水",
    icon: "记",
    description: "查看上架、拣货和退回记录",
    href: "/admin/warehouse?tab=logs",
    tone: "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950",
  },
];

const vapeIconTiles = [
  {
    src: "/icons/batch/green-plum-tea-128.png",
    motionClass: styles.vapeIconFloat,
  },
  {
    src: "/icons/batch/spring-blossom-128.png",
    motionClass: styles.vapeIconTilt,
  },
  {
    src: "/icons/batch/peach-128.png",
    motionClass: styles.vapeIconPulse,
  },
  {
    src: "/icons/batch/apple-128.png",
    motionClass: styles.vapeIconFloat,
  },
  {
    src: "/icons/batch/bubblemon-128.png",
    motionClass: styles.vapeIconHop,
  },
  {
    src: "/icons/batch/lychee-128.png",
    motionClass: styles.vapeIconTilt,
  },
  {
    src: "/icons/batch/rose-gold-128.png",
    motionClass: styles.vapeIconPulse,
  },
  {
    src: "/icons/batch/pineapple-lemonade-128.png",
    motionClass: styles.vapeIconTilt,
  },
];

const orderStatusMeta: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  uploaded: {
    label: "已上传",
    className:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
  },
  need_review: {
    label: "待审核",
    className:
      "bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
  },
  picking: {
    label: "拣货中",
    className:
      "bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-950/40 dark:text-green-200 dark:ring-green-900",
  },
  confirmed: {
    label: "待拣货",
    className:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
  },
  packing: {
    label: "待分货打包",
    className:
      "bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
  },
};

const logTypeLabel: Record<string, string> = {
  count: "盘点上架",
  inbound: "补货",
  pick: "集中拣货",
  pack: "打包完成",
  return: "余货退回",
};

function getOrderStatus(status: string) {
  return (
    orderStatusMeta[status] || {
      label: status,
      className:
        "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
    }
  );
}

function getLogChange(value: number | null) {
  const change = Number(value || 0);
  return change > 0 ? `+${change}` : String(change);
}

function relatedProduct(value: unknown): Record<string, unknown> | null {
  const record = Array.isArray(value) ? value[0] : value;
  return record && typeof record === "object"
    ? (record as Record<string, unknown>)
    : null;
}

export default async function HomePage() {
  const isAdmin = await isWarehouseAdmin();
  let needReviewCount: number | null = null;
  let readyCount: number | null = null;
  let workOrders: WorkOrder[] = [];
  let recentLogs: RecentLog[] = [];
  let overviewUnavailable = false;
  if (isAdmin) {
    const results = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["uploaded", "need_review"]),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),
      supabaseAdmin
        .from("orders")
        .select("id,order_no,address,batch_id,status,total_items,created_at")
        .in("status", [
          "uploaded",
          "need_review",
          "confirmed",
          "picking",
          "packing",
        ])
        .order("created_at", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("warehouse_events")
        .select(
          "id,action,quantity,note,created_at,products(sku,display_name,product_name_cn)",
        )
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    overviewUnavailable = results.some((result) => Boolean(result.error));
    if (!overviewUnavailable) {
      needReviewCount = results[0].count || 0;
      readyCount = results[1].count || 0;
      workOrders = (results[2].data || []) as unknown as WorkOrder[];
      recentLogs = (results[3].data || []).map((log) => {
        const product = relatedProduct(log.products);
        return {
          id: log.id,
          sku_snapshot: product ? String(product.sku) : null,
          product_name_snapshot: product
            ? String(product.display_name || product.product_name_cn || "")
            : log.note,
          change_qty: log.quantity,
          log_type: log.action,
          created_at: log.created_at,
        };
      });
    }
  }

  return (
    <PageShell maxWidth="max-w-7xl">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-white shadow-sm shadow-zinc-200/80 dark:bg-[var(--surface)] dark:shadow-none">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 md:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Warehouse Daily Board
              </p>

              <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50 md:text-6xl">
                电子烟仓库作业台
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)] md:text-lg">
                每天上传订单截图，统一按库位拣货，再按每单分货打包。
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <NavButton href="/admin/upload" variant="primary">
                  上传订单截图
                </NavButton>
                <NavButton href="/admin/warehouse?tab=orders" variant="warning">
                  查看订单
                </NavButton>
                <NavButton
                  href="/admin/warehouse?tab=batches"
                  variant="success"
                >
                  集中拣货 / 分货打包
                </NavButton>
                <NavButton href="/admin/inventory">库存列表</NavButton>
                <NavButton href="/admin/warehouse?tab=logs" variant="quiet">
                  作业流水
                </NavButton>
              </div>
            </div>

            <div className="border-t border-[var(--border-soft)] bg-[var(--surface-soft)] p-5 dark:bg-zinc-950/30 lg:border-l lg:border-t-0 md:p-7">
              <div className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm shadow-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-none">
                今日先看这里
              </div>

              <Link
                href="/admin/upload"
                className="mt-5 block rounded-3xl border border-blue-200 bg-white p-5 shadow-sm shadow-blue-100/70 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-blue-900 dark:bg-zinc-900 dark:shadow-none dark:hover:border-blue-700"
              >
                <p className="text-sm font-semibold text-[var(--primary)]">
                  新订单入口
                </p>
                <p className="mt-1 text-3xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                  提交新订单
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  上传订单截图，填写地址和备注，开始 AI 识别流程。
                </p>
                <span className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white">
                  开始上传
                </span>
              </Link>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-900 dark:bg-orange-950/30">
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-200">
                    待审核
                  </p>
                  <p className="mt-1 text-4xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                    {needReviewCount ?? "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-green-200 bg-green-50/80 p-4 dark:border-green-900 dark:bg-green-950/30">
                  <p className="text-sm font-medium text-green-700 dark:text-green-200">
                    待拣货
                  </p>
                  <p className="mt-1 text-4xl font-bold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">
                    {readyCount ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {!isAdmin && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--muted)]">
              登录后查看订单、库存和作业进度。
            </p>
            <NavButton href="/login?next=%2F" variant="primary">
              管理员登录
            </NavButton>
          </div>
        )}

        <section className={styles.vapeIconStrip} aria-label="电子烟图标动画">
          {vapeIconTiles.map((icon) => (
            <div className={styles.vapeIconTile} key={icon.src}>
              <Image
                className={`${styles.vapeIcon} ${icon.motionClass}`}
                src={icon.src}
                alt=""
                width={128}
                height={128}
                loading="eager"
              />
              <span className={styles.vapeIconShadow} />
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Current Work
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                  当前作业队列
                </h2>
              </div>

              <NavButton href="/admin/warehouse?tab=orders" variant="warning">
                查看全部订单
              </NavButton>
            </div>

            {workOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-[var(--surface-soft)] p-6 text-sm text-[var(--muted)] dark:border-zinc-700">
                {overviewUnavailable
                  ? "暂时无法读取作业概览，请稍后重试。"
                  : isAdmin
                    ? "暂时没有待处理订单。上架完成后，可以上传当天的订单截图。"
                    : "登录后查看待处理订单和作业进度。"}
              </div>
            ) : (
              <div className="space-y-3">
                {workOrders.map((order) => {
                  const status = getOrderStatus(order.status);

                  return (
                    <Link
                      key={order.id}
                      href={
                        order.batch_id
                          ? `/admin/warehouse?tab=batches&batch=${order.batch_id}`
                          : `/admin/orders/${order.id}`
                      }
                      className="block rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] p-4 transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-orange-800 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-bold tracking-[-0.02em] text-orange-600 dark:text-orange-300">
                            {order.order_no}
                          </p>
                          <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-300">
                            {order.address || "地址未填写"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                        <span>商品数：{order.total_items ?? "-"}</span>
                        <span>{formatEasternTime(order.created_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Quick Actions
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                  快速操作
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] p-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
                  >
                    <span
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm ${action.tone}`}
                    >
                      {action.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-zinc-950 dark:text-zinc-50">
                        {action.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-[var(--muted)]">
                        {action.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Recent Logs
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                    最近作业流水
                  </h2>
                </div>
                <Link
                  href="/admin/warehouse?tab=logs"
                  className="text-sm font-semibold text-[var(--primary)] hover:underline"
                >
                  全部
                </Link>
              </div>

              {recentLogs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-300 bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)] dark:border-zinc-700">
                  {overviewUnavailable
                    ? "暂时无法读取作业流水。"
                    : isAdmin
                      ? "暂无作业流水。"
                      : "登录后查看上架、拣货和打包记录。"}
                </p>
              ) : (
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-50">
                            {log.sku_snapshot || "-"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                            {log.product_name_snapshot || "-"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 text-sm font-black ${
                            Number(log.change_qty || 0) < 0
                              ? "text-red-600 dark:text-red-300"
                              : "text-green-600 dark:text-green-300"
                          }`}
                        >
                          {getLogChange(log.change_qty)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <span>
                          {logTypeLabel[String(log.log_type || "")] ||
                            log.log_type ||
                            "-"}
                        </span>
                        <span>{formatEasternTime(log.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
