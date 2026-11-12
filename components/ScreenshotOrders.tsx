"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Panel, getActionButtonClass } from "./PageChrome";
import { easternToday } from "@/lib/warehouse";
type Entry = {
  id: string;
  customer: string;
  address: string;
  note: string;
  images: File[];
  status: string;
  orderId?: string;
  error?: string;
};
const empty = (id = crypto.randomUUID()): Entry => ({
  id,
  customer: "",
  address: "",
  note: "",
  images: [],
  status: "draft",
});
const input =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2";
function ImagePreview({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const src = URL.createObjectURL(file);
    if (ref.current) ref.current.src = src;
    return () => URL.revokeObjectURL(src);
  }, [file]);
  // Object URLs are local screenshot previews, not remote images.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      alt={file.name}
      className="h-32 w-24 rounded-lg border object-cover"
    />
  );
}
export default function ScreenshotOrders() {
  const [entries, setEntries] = useState<Entry[]>(() => [empty("first-order")]);
  const [date, setDate] = useState(easternToday());
  const [busy, setBusy] = useState(false);
  const update = (id: string, value: Partial<Entry>) =>
    setEntries((old) => old.map((e) => (e.id === id ? { ...e, ...value } : e)));
  async function upload() {
    setBusy(true);
    for (const entry of entries.filter((e) => e.status !== "done")) {
      update(entry.id, { status: "uploading", error: undefined });
      try {
        if (!entry.images.length || !entry.address.trim())
          throw new Error("请添加截图并填写地址 / 订单标识");
        const form = new FormData();
        entry.images.forEach((file) => form.append("images", file));
        form.set("customerName", entry.customer);
        form.set("address", entry.address);
        form.set("note", entry.note);
        form.set("businessDate", date);
        const response = await fetch("/api/orders/create", {
          method: "POST",
          headers: { Accept: "application/json", "x-requested-with": "fetch" },
          body: form,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "上传失败");
        update(entry.id, { status: "done", orderId: result.order.id });
      } catch (error) {
        update(entry.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "上传失败",
        });
      }
    }
    setBusy(false);
  }
  const pending = entries.filter((e) => e.status !== "done");
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label>
            订单业务日期
            <input
              className={input}
              type="date"
              value={date}
              disabled={busy}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            className={getActionButtonClass()}
            disabled={busy}
            onClick={() => setEntries([...entries, empty()])}
          >
            ＋ 添加一张订单
          </button>
          <label className={getActionButtonClass()}>
            批量选图，每图一单
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setEntries((old) => [
                  ...old.filter((x) => x.images.length || x.address),
                  ...files.map((file) => ({ ...empty(), images: [file] })),
                ]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            className={getActionButtonClass("primary")}
            disabled={busy || !pending.length || !date}
            onClick={upload}
          >
            {busy ? "正在逐单上传…" : `上传未完成订单（${pending.length} 单）`}
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          每单最多 5 张截图、每张最多
          10MB。多页订单请在同一张卡片选多图。成功的订单不会重复上传；失败的卡片可修改后重试。
        </p>
      </Panel>
      {entries.map((entry, index) => (
        <Panel key={entry.id}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">
              订单 {index + 1}{" "}
              {entry.status === "done"
                ? "· 已上传"
                : entry.status === "uploading"
                  ? "· 上传中"
                  : ""}
            </h2>
            {entry.status !== "done" && (
              <button
                className={getActionButtonClass("quiet")}
                disabled={busy}
                onClick={() =>
                  setEntries(entries.filter((e) => e.id !== entry.id))
                }
              >
                移除
              </button>
            )}
          </div>
          {entry.orderId ? (
            <Link
              className={getActionButtonClass("primary")}
              href={`/admin/orders/${entry.orderId}`}
            >
              核对商品与截图
            </Link>
          ) : (
            <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
              <label>
                客户名称
                <input
                  className={input}
                  value={entry.customer}
                  onChange={(e) =>
                    update(entry.id, { customer: e.target.value })
                  }
                />
              </label>
              <label>
                地址 / 订单标识（必填）
                <input
                  className={input}
                  value={entry.address}
                  onChange={(e) =>
                    update(entry.id, { address: e.target.value })
                  }
                />
              </label>
              <label>
                备注
                <input
                  className={input}
                  value={entry.note}
                  onChange={(e) => update(entry.id, { note: e.target.value })}
                />
              </label>
              <label>
                本单截图（可多张）
                <input
                  className={`${input} text-sm`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  onChange={(e) =>
                    update(entry.id, {
                      images: Array.from(e.target.files || []),
                    })
                  }
                />
              </label>
            </fieldset>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.images.map((file, i) => (
              <ImagePreview file={file} key={`${file.name}-${i}`} />
            ))}
          </div>
          {entry.error && (
            <p role="alert" className="mt-3 text-red-600">
              {entry.error}
            </p>
          )}
        </Panel>
      ))}
      {entries.some((e) => e.status === "done") && (
        <Link
          className={getActionButtonClass("primary")}
          href="/admin/warehouse"
        >
          返回作业台审核并组批
        </Link>
      )}
    </div>
  );
}
