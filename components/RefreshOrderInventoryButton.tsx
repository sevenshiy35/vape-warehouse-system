"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getActionButtonClass } from "./PageChrome";

export default function RefreshOrderInventoryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={getActionButtonClass()}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "重新计算中…" : "刷新库存匹配"}
    </button>
  );
}
