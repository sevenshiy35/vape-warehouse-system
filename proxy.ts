import { NextResponse, type NextRequest } from 'next/server'

const desktopBypassCookie = 'vw_desktop'

function isMobileUserAgent(userAgent: string) {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    userAgent
  )
}

function mobileTarget(pathname: string) {
  if (pathname === '/') return '/mobile/orders'
  if (pathname === '/submit-order') return '/mobile/submit-order'
  if (pathname === '/admin/orders') return '/mobile/orders'

  const orderDetailMatch = pathname.match(/^\/admin\/orders\/([^/]+)$/)
  if (orderDetailMatch) return `/mobile/orders/${orderDetailMatch[1]}`

  return null
}

export function proxy(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return NextResponse.next()
  }

  const { nextUrl } = request

  if (nextUrl.searchParams.get('desktop') === '1') {
    const response = NextResponse.next()
    response.cookies.set(desktopBypassCookie, '1', {
      maxAge: 60 * 60 * 12,
      path: '/',
      sameSite: 'lax',
    })
    return response
  }

  if (request.cookies.get(desktopBypassCookie)?.value === '1') {
    return NextResponse.next()
  }

  if (!isMobileUserAgent(request.headers.get('user-agent') || '')) {
    return NextResponse.next()
  }

  const targetPath = mobileTarget(nextUrl.pathname)
  if (!targetPath) {
    return NextResponse.next()
  }

  const targetUrl = nextUrl.clone()
  targetUrl.pathname = targetPath
  targetUrl.searchParams.delete('desktop')

  return NextResponse.redirect(targetUrl)
}

export const config = {
  matcher: [
    '/((?!api|mobile|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
