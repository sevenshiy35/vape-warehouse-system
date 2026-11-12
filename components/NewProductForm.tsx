"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "./FeedbackProvider";
import { getActionButtonClass, Panel } from "./PageChrome";
export default function NewProductForm({
  brandOptions = [],
}: {
  brandOptions?: string[];
}) {
  const router = useRouter(),
    { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState({
    sku: "",
    brand: "",
    productNameCN: "",
    displayName: "",
    productNameEN: "",
    boxMultiplier: 1,
    cartonMultiplier: 1,
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error);
      notify({
        type: "success",
        title: "商品已创建，请到盘点上架录入各库位数量",
      });
      router.push("/admin/warehouse?tab=stock");
    } catch (e) {
      notify({
        type: "error",
        title: "创建失败",
        message: e instanceof Error ? e.message : "请重试",
      });
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-1 min-h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2";
  return (
    <Panel>
      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <label>
          SKU（留空自动生成）
          <input
            className={input}
            value={value.sku}
            onChange={(e) => setValue({ ...value, sku: e.target.value })}
          />
        </label>
        <label>
          品牌
          <input
            className={input}
            required
            list="brands"
            value={value.brand}
            onChange={(e) =>
              setValue({
                ...value,
                brand: e.target.value,
                boxMultiplier: e.target.value === "Yohuu烟弹" ? 3 : 1,
                cartonMultiplier: e.target.value === "真烟" ? 10 : 1,
              })
            }
          />
          <datalist id="brands">
            {brandOptions.map((b) => (
              <option value={b} key={b} />
            ))}
          </datalist>
        </label>
        <label>
          中文品名
          <input
            className={input}
            required
            value={value.productNameCN}
            onChange={(e) =>
              setValue({ ...value, productNameCN: e.target.value })
            }
          />
        </label>
        <label>
          显示名称
          <input
            className={input}
            value={value.displayName}
            onChange={(e) =>
              setValue({ ...value, displayName: e.target.value })
            }
          />
        </label>
        <label>
          英文品名
          <input
            className={input}
            value={value.productNameEN}
            onChange={(e) =>
              setValue({ ...value, productNameEN: e.target.value })
            }
          />
        </label>
        <label>
          订单每盒换算为多少个
          <input
            type="number"
            min="1"
            max="10000"
            className={input}
            required
            value={value.boxMultiplier}
            onChange={(e) =>
              setValue({ ...value, boxMultiplier: Number(e.target.value) })
            }
          />
        </label>
        <label>
          订单每条换算为多少个
          <input
            type="number"
            min="1"
            max="10000"
            className={input}
            required
            value={value.cartonMultiplier}
            onChange={(e) =>
              setValue({ ...value, cartonMultiplier: Number(e.target.value) })
            }
          />
        </label>
        <p className="text-sm text-[var(--muted)] md:col-span-2">
          这里只创建商品资料。创建后到“盘点上架”录入散货位、整盒位及实际数量。
        </p>
        <button className={getActionButtonClass("primary")} disabled={busy}>
          {busy ? "创建中…" : "创建商品"}
        </button>
      </form>
    </Panel>
  );
}
