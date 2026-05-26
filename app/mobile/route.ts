import { htmlResponse } from './_lib'

export function GET() {
  return htmlResponse(
    '仓库系统',
    `
      <main class="stack">
        <section class="hero">
          <p class="eyebrow">Warehouse</p>
          <h1>仓库系统</h1>
          <p>快速提交订单、查看订单进度和处理拣货。</p>
        </section>

        <section class="stack">
          <a class="card home-action" href="/mobile/submit-order">
            <strong>提交订单</strong>
            <span>上传订单截图，填写地址和备注。</span>
          </a>
          <a class="card home-action" href="/mobile/orders">
            <strong>订单列表</strong>
            <span>查看最新订单、状态和详情操作。</span>
          </a>
          <a class="card home-action" href="/?desktop=1">
            <strong>电脑版页面</strong>
            <span>需要完整后台功能时打开。</span>
          </a>
        </section>
      </main>
    `
  )
}
