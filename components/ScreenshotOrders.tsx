"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Panel, getActionButtonClass } from "./PageChrome";
import { easternToday } from "@/lib/warehouse";
type Entry = {
  id: string;
  address: string;
  note: string;
  images: File[];
  status: string;
  orderId?: string;
  error?: string;
};
const empty = (id = crypto.randomUUID()): Entry => ({
  id,
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
      className="h-32 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--background)] object-contain"
    />
  );
}
function UploadIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4" />
    </svg>
  );
}

const imageTypes = "image/jpeg,image/png,image/webp,image/heic,image/heif";
function imageError(files: File[]) {
  if (files.length > 5) return "同一订单最多 5 张截图，请先移除多余图片。";
  if (files.some((file) => file.size > 10 * 1024 * 1024))
    return "每张截图最多 10MB，请换一张较小的图片。";
  if (files.some((file) => !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)))
    return "请选择 JPG、PNG、WebP、HEIC 或 HEIF 图片。";
}
export default function ScreenshotOrders() {
  const [entries, setEntries] = useState<Entry[]>(() => [empty("first-order")]);
  const [date, setDate] = useState(easternToday());
  const [busy, setBusy] = useState(false);
  const update = (id: string, value: Partial<Entry>) =>
    setEntries((old) => old.map((e) => (e.id === id ? { ...e, ...value } : e)));
  function addImages(entry: Entry, selected: File[]) {
    if (!selected.length) return;
    const images = [...entry.images];
    for (const file of selected) {
      if (
        !images.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        )
      )
        images.push(file);
    }
    const error = imageError(images);
    update(entry.id, error ? { error } : { images, error: undefined });
  }
  async function upload() {
    setBusy(true);
    for (const entry of entries.filter((e) => e.status !== "done")) {
      update(entry.id, { status: "uploading", error: undefined });
      try {
        if (!entry.images.length) throw new Error("请先选择本单的订单截图。");
        if (!entry.address.trim()) throw new Error("请填写地址 / 订单标识。");
        const invalidImage = imageError(entry.images);
        if (invalidImage) throw new Error(invalidImage);
        const form = new FormData();
        entry.images.forEach((file) => form.append("images", file));
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
  const completed = entries.length - pending.length;
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label
              className={`${getActionButtonClass("primary")} min-h-16 cursor-pointer gap-3 px-5 focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:ring-offset-2 ${busy ? "pointer-events-none opacity-50" : ""}`}
            >
              <UploadIcon className="h-7 w-7 shrink-0" />
              <span>
                <span className="block text-base">批量选择订单截图</span>
                <span className="mt-0.5 block text-xs font-normal text-white/85">
                  每张截图创建一单
                </span>
              </span>
              <input
                type="file"
                accept={imageTypes}
                multiple
                className="sr-only"
                aria-label="批量选择订单截图，每张截图一单"
                disabled={busy}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length)
                    setEntries((old) => [
                      ...old.filter(
                        (entry) =>
                          entry.images.length ||
                          entry.address.trim() ||
                          entry.note.trim() ||
                          entry.status === "done",
                      ),
                      ...files.map((file) => ({
                        ...empty(),
                        images: [file],
                        error: imageError([file]),
                      })),
                    ]);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className={getActionButtonClass()}
              disabled={busy}
              onClick={() => setEntries((old) => [...old, empty()])}
            >
              ＋ 添加一张订单
            </button>
          </div>
          <label className="shrink-0 text-sm font-medium sm:w-44">
            订单日期
            <input
              className={input}
              type="date"
              value={date}
              disabled={busy}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          同一订单有多张截图？在下方同一张订单里选择多图，最多 5 张，每张不超过
          10MB。
        </p>
      </Panel>

      {!entries.length && (
        <Panel>
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            还没有订单，点击上方蓝色按钮选择截图。
          </p>
        </Panel>
      )}

      {entries.map((entry, index) => (
        <Panel key={entry.id}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">
                订单 {String(index + 1).padStart(2, "0")}
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.status === "done" ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" : entry.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" : "bg-[var(--background)] text-[var(--muted)]"}`}
              >
                {entry.status === "done"
                  ? "已上传"
                  : entry.status === "uploading"
                    ? "正在上传…"
                    : entry.status === "failed"
                      ? "上传失败，可重试"
                      : "待上传"}
              </span>
            </div>
            {entry.status !== "done" && (
              <button
                type="button"
                className={getActionButtonClass("quiet")}
                disabled={busy}
                aria-label={`移除订单 ${index + 1}`}
                onClick={() =>
                  setEntries((old) =>
                    old.filter((item) => item.id !== entry.id),
                  )
                }
              >
                移除
              </button>
            )}
          </div>
          {entry.orderId ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-green-50 p-4 dark:bg-green-950/20">
              <div>
                <p className="font-medium">{entry.address}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {entry.images.length} 张截图已上传，正在自动识别商品。
                </p>
              </div>
              <Link
                className={getActionButtonClass("primary")}
                href={`/admin/orders/${entry.orderId}`}
              >
                核对商品与截图 →
              </Link>
            </div>
          ) : (
            <fieldset disabled={busy} className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <p className="font-semibold">
                    订单截图{" "}
                    <span className="text-[var(--muted)]">（必选）</span>
                  </p>
                  <span className="text-xs text-[var(--muted)]">
                    已选 {entry.images.length} / 5 张
                  </span>
                </div>
                <label
                  className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/70 p-5 text-center text-blue-700 transition hover:border-blue-500 hover:bg-blue-100/70 focus-within:ring-2 focus-within:ring-blue-500 dark:border-blue-800 dark:bg-blue-950/25 dark:text-blue-300 dark:hover:border-blue-500 dark:hover:bg-blue-950/50 ${busy || entry.images.length >= 5 ? "pointer-events-none opacity-50" : ""}`}
                >
                  <UploadIcon className="h-8 w-8" />
                  <span className="font-semibold">
                    {entry.images.length >= 5
                      ? "已选满 5 张截图"
                      : entry.images.length
                        ? "继续添加本单截图"
                        : "点击选择订单截图"}
                  </span>
                  <span className="text-xs text-blue-600/85 dark:text-blue-300/80">
                    同一订单可多选 · JPG / PNG / WebP / HEIC
                  </span>
                  <input
                    type="file"
                    accept={imageTypes}
                    multiple
                    className="sr-only"
                    disabled={busy || entry.images.length >= 5}
                    aria-label={`为订单 ${index + 1} 选择截图`}
                    onChange={(e) => {
                      addImages(entry, Array.from(e.target.files || []));
                      e.target.value = "";
                    }}
                  />
                </label>
                {entry.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {entry.images.map((file, i) => (
                      <div
                        key={`${file.name}-${i}`}
                        className="min-w-0 rounded-xl border border-[var(--border-soft)] p-2"
                      >
                        <ImagePreview file={file} />
                        <p
                          className="mt-2 truncate text-xs text-[var(--muted)]"
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <button
                          type="button"
                          className="mt-1 min-h-9 w-full rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
                          aria-label={`移除订单 ${index + 1} 的截图 ${i + 1}`}
                          onClick={() =>
                            update(entry.id, {
                              images: entry.images.filter(
                                (_, imageIndex) => imageIndex !== i,
                              ),
                              error: undefined,
                            })
                          }
                        >
                          移除截图
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  地址 / 订单标识{" "}
                  <span className="text-[var(--muted)]">（必填）</span>
                  <input
                    className={input}
                    placeholder="填写地址、房号或你用来区分订单的标识"
                    value={entry.address}
                    onChange={(e) =>
                      update(entry.id, { address: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-medium">
                  备注 <span className="text-[var(--muted)]">（选填）</span>
                  <input
                    className={input}
                    placeholder="例如：换口味、合单等需要核对的信息"
                    value={entry.note}
                    onChange={(e) => update(entry.id, { note: e.target.value })}
                  />
                </label>
              </div>
            </fieldset>
          )}
          {entry.error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
            >
              {entry.error}
            </p>
          )}
        </Panel>
      ))}

      <div
        className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between"
        aria-live="polite"
      >
        <div>
          <p className="font-semibold">
            待上传 {pending.length} 单
            {completed > 0 && (
              <span className="ml-3 text-sm font-normal text-green-700 dark:text-green-300">
                已上传 {completed} 单
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            上传后自动识别，核对商品后再汇总拣货。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {completed > 0 && (
            <Link
              className={getActionButtonClass()}
              href="/admin/warehouse?tab=orders"
            >
              查看已上传订单
            </Link>
          )}
          <button
            type="button"
            className={`${getActionButtonClass("primary")} min-h-12 flex-1 px-6 sm:flex-none`}
            disabled={busy || !pending.length || !date}
            onClick={upload}
          >
            {busy ? "正在逐单上传…" : `上传并识别（${pending.length} 单）`}
          </button>
        </div>
      </div>
    </div>
  );
}
