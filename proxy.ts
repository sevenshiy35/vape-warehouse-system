import { NextRequest, NextResponse } from "next/server";

const PUBLIC_API_PATHS = ["/api/login", "/api/logout"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isApiRoute = pathname.startsWith("/api");
  const isPublicApi = PUBLIC_API_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (!isAdminPage && !isApiRoute) {
    return NextResponse.next();
  }

  if (isPublicApi) {
    return NextResponse.next();
  }

  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const authCookie = req.cookies.get("admin_auth")?.value;

  const isLoggedIn =
    sessionSecret && authCookie && authCookie === sessionSecret;

  if (isLoggedIn) {
    return NextResponse.next();
  }

  if (isApiRoute) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};