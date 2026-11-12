"use client";
export default function WarehouseError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">暂时无法读取仓库</h1>
      <p className="my-4">请检查网络后重试，未确认的操作不会扣库存。</p>
      <button onClick={reset} className="rounded-xl bg-blue-600 p-3 text-white">
        重新读取
      </button>
    </main>
  );
}
