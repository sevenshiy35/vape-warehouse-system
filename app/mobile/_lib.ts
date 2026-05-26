import { NextResponse } from 'next/server'

export const mobileStyles = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f8fafc;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main { max-width: 560px; margin: 0 auto; padding: 18px 14px 40px; }
  header { border-bottom: 1px solid #e5e7eb; padding-bottom: 14px; margin-bottom: 14px; }
  h1 { margin: 4px 0 0; font-size: 26px; line-height: 1.15; }
  h2 { margin: 0 0 12px; font-size: 18px; }
  p { margin: 0; }
  a { color: #1d4ed8; }
  .eyebrow { color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .stack { display: grid; gap: 12px; }
  .row { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
  .card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  }
  .muted { color: #6b7280; font-size: 13px; }
  .small { font-size: 13px; }
  .label { color: #6b7280; font-size: 13px; margin-bottom: 3px; }
  .value { font-weight: 650; overflow-wrap: anywhere; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .btn, button {
    appearance: none;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #fff;
    color: #111827;
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
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
    background: #fff;
    color: #111827;
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
  img { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid #e5e7eb; }
  .danger-zone { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 10px; }
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
