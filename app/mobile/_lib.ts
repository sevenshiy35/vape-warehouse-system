import { NextResponse } from 'next/server'

export const mobileStyles = `
  :root {
    color-scheme: light dark;
    --bg: #fff7fb;
    --surface: #fff;
    --surface-soft: #fff1f7;
    --text: #2a1823;
    --muted: #7c6470;
    --border: #f4d4e2;
    --border-strong: #e8b8cc;
    --link: #be185d;
    --shadow: rgba(190, 24, 93, 0.09);
    --accent-gold: #d99a18;
    --accent-pink: #db2777;
    --accent-pink-soft: #fce7f3;
    --danger-bg: #fef2f2;
    --danger-border: #fecaca;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #190f15;
      --surface: #24161f;
      --surface-soft: #301c28;
      --text: #fff7fb;
      --muted: #d7b8c7;
      --border: #4b2638;
      --border-strong: #6b3650;
      --link: #f9a8d4;
      --shadow: rgba(0, 0, 0, 0.34);
      --accent-gold: #f4c563;
      --accent-pink: #f472b6;
      --accent-pink-soft: rgba(244, 114, 182, 0.12);
      --danger-bg: rgba(127, 29, 29, 0.28);
      --danger-border: rgba(248, 113, 113, 0.35);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main { max-width: 560px; margin: 0 auto; padding: 18px 14px 40px; }
  header { border-bottom: 1px solid var(--border); padding-bottom: 14px; margin-bottom: 14px; }
  h1 { margin: 4px 0 0; font-size: 26px; line-height: 1.15; }
  h2 { margin: 0 0 12px; font-size: 18px; }
  p { margin: 0; }
  a { color: var(--link); }
  .eyebrow { color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .stack { display: grid; gap: 12px; }
  .row { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
    box-shadow: 0 1px 2px var(--shadow);
  }
  .hero {
    min-height: 168px;
    display: grid;
    align-content: end;
    gap: 8px;
    border-radius: 12px;
    padding: 18px;
    border: 1px solid rgba(217, 154, 24, 0.34);
    background: linear-gradient(135deg, #f59e0b 0%, #db2777 54%, #8b1e55 100%);
    color: #fff;
    box-shadow: 0 18px 34px rgba(190, 24, 93, 0.22);
  }
  .hero p { color: rgba(255, 255, 255, 0.84); }
  .hero .eyebrow { color: rgba(255, 255, 255, 0.78); }
  .home-action {
    display: grid;
    gap: 6px;
    text-decoration: none;
    color: inherit;
    border-color: var(--border);
    background: linear-gradient(180deg, var(--surface), var(--surface-soft));
  }
  .home-action strong { font-size: 18px; }
  .home-action span { color: var(--muted); font-size: 13px; }
  .home-action::before {
    content: "";
    width: 42px;
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent-gold), var(--accent-pink));
  }
  .muted { color: var(--muted); font-size: 13px; }
  .small { font-size: 13px; }
  .label { color: var(--muted); font-size: 13px; margin-bottom: 3px; }
  .value { font-weight: 650; overflow-wrap: anywhere; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .btn, button {
    appearance: none;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    display: inline-flex;
    min-height: 46px;
    width: 100%;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    font-size: 15px;
    font-weight: 700;
    text-decoration: none;
  }
  .btn-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
  .btn-dark { background: #111827; border-color: #111827; color: #fff; }
  .btn-success { background: #15803d; border-color: #15803d; color: #fff; }
  .btn-danger { background: #dc2626; border-color: #dc2626; color: #fff; }
  button:disabled, .btn-disabled { opacity: 0.45; pointer-events: none; }
  input, textarea, select {
    width: 100%;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
    background: var(--surface);
    color: var(--text);
  }
  textarea { min-height: 92px; }
  label { display: block; font-size: 14px; font-weight: 650; margin-bottom: 5px; }
  form { margin: 0; }
  details > summary { cursor: pointer; font-size: 18px; font-weight: 750; }
  details[open] > summary { margin-bottom: 12px; }
  .notice { border-radius: 10px; padding: 12px; font-size: 14px; }
  .ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
  .err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  .status { border-radius: 999px; display: inline-flex; padding: 5px 9px; font-size: 12px; font-weight: 700; }
  .status-blue { background: #dbeafe; color: #1e40af; }
  .status-green { background: #dcfce7; color: #166534; }
  .status-red { background: #fee2e2; color: #991b1b; }
  .status-yellow { background: #fef3c7; color: #92400e; }
  .status-orange { background: #ffedd5; color: #9a3412; }
  .status-purple { background: #f3e8ff; color: #6b21a8; }
  img { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--border); }
  .danger-zone { background: var(--danger-bg); border: 1px solid var(--danger-border); border-radius: 10px; padding: 10px; }
  @media (prefers-color-scheme: dark) {
    .ok { background: rgba(20, 83, 45, 0.32); border-color: rgba(74, 222, 128, 0.35); color: #bbf7d0; }
    .err { background: rgba(127, 29, 29, 0.32); border-color: rgba(248, 113, 113, 0.35); color: #fecaca; }
    .status-blue { background: rgba(30, 64, 175, 0.38); color: #bfdbfe; }
    .status-green { background: rgba(22, 101, 52, 0.38); color: #bbf7d0; }
    .status-red { background: rgba(127, 29, 29, 0.38); color: #fecaca; }
    .status-yellow { background: rgba(146, 64, 14, 0.38); color: #fde68a; }
    .status-orange { background: rgba(154, 52, 18, 0.38); color: #fed7aa; }
    .status-purple { background: rgba(107, 33, 168, 0.38); color: #e9d5ff; }
  }
`

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function pageHtml(title: string, body: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <style>${mobileStyles}</style>
</head>
<body>${body}</body>
</html>`
}

export function htmlResponse(title: string, body: string, status = 200) {
  return new NextResponse(pageHtml(title, body), {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  })
}

export function redirectTo(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
    },
  })
}

export function withMessage(
  href: string,
  type: 'success' | 'error',
  message: string
) {
  const url = new URL(href, 'http://local')
  url.searchParams.set(type, message)
  return `${url.pathname}${url.search}`
}

export function getOrderStatusLabel(status: string) {
  if (status === 'uploaded') return '已上传'
  if (status === 'need_review') return '待确认'
  if (status === 'picking') return '拣货中'
  if (status === 'picking_editing') return '拣货修改中'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return status
}

export function getOrderStatusClass(status: string) {
  if (status === 'completed') return 'status status-green'
  if (status === 'cancelled') return 'status status-red'
  if (status === 'picking') return 'status status-orange'
  if (status === 'picking_editing') return 'status status-purple'
  if (status === 'need_review') return 'status status-yellow'
  return 'status status-blue'
}

export function getItemStatusLabel(status: string) {
  if (status === 'matched') return '已匹配'
  if (status === 'out_of_stock') return '库存不足'
  if (status === 'need_review') return '需确认'
  if (status === 'not_found') return '未匹配'
  return status
}

export function getItemStatusClass(status: string) {
  if (status === 'matched') return 'status status-green'
  if (status === 'out_of_stock') return 'status status-red'
  if (status === 'need_review') return 'status status-yellow'
  return 'status'
}

export function getFileExt(file: File) {
  const name = file.name || ''
  const fromName = name.split('.').pop()?.toLowerCase()

  if (
    fromName &&
    ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(fromName)
  ) {
    return fromName
  }

  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'image/heif') return 'heif'

  return 'jpg'
}
