import { htmlResponse } from './_lib'

export function GET() {
  return htmlResponse(
    '电子烟仓库管理系统',
    `
      <main class="stack">
        <section class="hero">
          <p class="eyebrow">Warehouse</p>
          <h1>电子烟仓库管理系统</h1>
          <p>快速提交订单，后台管理请使用电脑端页面。</p>
        </section>

        <section class="stack">
          <a class="card home-action" href="/mobile/submit-order">
            <strong>提交订单</strong>
            <span>上传订单截图，填写地址和备注。</span>
          </a>
        </section>
      </main>
    `
  )
}
