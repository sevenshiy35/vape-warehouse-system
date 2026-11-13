import type { InventoryForecast } from "@/lib/orderInventory";

export default function OrderInventoryStatus({
  forecast,
  compact = false,
}: {
  forecast: InventoryForecast;
  compact?: boolean;
}) {
  const bad =
    forecast.status === "insufficient" || forecast.status === "unmatched";
  const label =
    forecast.status === "sufficient"
      ? "库存充足"
      : forecast.status === "insufficient"
        ? `库存不足 · 缺 ${forecast.shortage} 个`
        : forecast.status === "unmatched"
          ? "未匹配商品，请手动选择"
          : "数量或单位待确认";
  if (compact) {
    return (
      <div className="space-y-1 text-sm">
        <p className="whitespace-nowrap font-semibold tabular-nums">
          {forecast.status === "unmatched" ? "—" : forecast.available}
          <span className="px-1 text-[var(--muted)]">→</span>
          <span
            className={
              forecast.shortage ? "text-red-600 dark:text-red-400" : ""
            }
          >
            {forecast.after ?? "—"}
          </span>
        </p>
        <details className="text-xs">
          <summary
            className={`cursor-pointer leading-5 ${bad ? "text-red-600 dark:text-red-400" : forecast.status === "sufficient" ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}
          >
            {forecast.status === "sufficient"
              ? "库存充足"
              : forecast.status === "insufficient"
                ? `缺 ${forecast.shortage} 个`
                : forecast.status === "unmatched"
                  ? "未匹配"
                  : "待确认"}
          </summary>
          <div className="mt-2 space-y-1 break-words leading-5 text-[var(--muted)]">
            <p>{label}</p>
            <p>
              现有 {forecast.onHand} 个 · 已占用 {forecast.reserved} 个
            </p>
            {forecast.before !== forecast.available && (
              <p>本单前项已需 {forecast.available - forecast.before} 个</p>
            )}
            {forecast.allocations.length > 0 && (
              <p>
                预计取货：
                {forecast.allocations
                  .map(
                    (bin) =>
                      `库位 ${bin.position} ${bin.location} × ${bin.quantity}`,
                  )
                  .join(" → ")}
              </p>
            )}
          </div>
        </details>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2 text-sm">
      <span
        className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${bad ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" : forecast.status === "sufficient" ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}
      >
        {label}
      </span>
      {forecast.status !== "unmatched" && (
        <>
          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--background)] p-3">
            <div>
              <dt className="text-xs text-[var(--muted)]">本项需拣</dt>
              <dd className="mt-1 font-semibold">
                {forecast.quantity ?? "待确认"}
                {forecast.quantity !== null && " 个"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">当前可用</dt>
              <dd className="mt-1 font-semibold">{forecast.available} 个</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">
                {forecast.shortage ? "本单累计缺口" : "预计剩余"}
              </dt>
              <dd
                className={`mt-1 font-semibold ${forecast.shortage ? "text-red-600 dark:text-red-400" : ""}`}
              >
                {forecast.after === null
                  ? "待确认"
                  : forecast.shortage || forecast.after}
                {forecast.after !== null && " 个"}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-[var(--muted)]">
            现有 {forecast.onHand} 个 · 其他批次占用 {forecast.reserved} 个
            {forecast.before !== forecast.available &&
              ` · 本单前项已需 ${forecast.available - forecast.before} 个`}
          </p>
          {forecast.allocations.length > 0 && (
            <p className="break-words text-xs text-[var(--muted)]">
              预计取货：
              {forecast.allocations
                .map(
                  (bin) =>
                    `库位 ${bin.position} ${bin.location} × ${bin.quantity}`,
                )
                .join(" → ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
