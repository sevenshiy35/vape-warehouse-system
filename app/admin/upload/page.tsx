import { PageShell, PageHeader, NavButton } from "@/components/PageChrome";
import ScreenshotOrders from "@/components/ScreenshotOrders";
export default function UploadOrdersPage() {
  return (
    <PageShell>
      <PageHeader
        title="上传当天订单"
        description="先选截图，再填地址或订单标识，上传后自动识别商品。同一订单的多张截图请放在一起。"
        actions={<NavButton href="/admin/warehouse">返回作业台</NavButton>}
      />
      <ScreenshotOrders />
    </PageShell>
  );
}
