import { PageShell, PageHeader, NavButton } from "@/components/PageChrome";
import ScreenshotOrders from "@/components/ScreenshotOrders";
export default function UploadOrdersPage() {
  return (
    <PageShell>
      <PageHeader
        title="上传当天订单"
        description="每张卡片对应一张订单，同一订单的多张截图放在同一张卡片里。上传后自动识别，核对完再汇总拣货。"
        actions={<NavButton href="/admin/warehouse">返回作业台</NavButton>}
      />
      <ScreenshotOrders />
    </PageShell>
  );
}
