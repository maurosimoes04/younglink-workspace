import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "yl_session";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (pathname === "/login" || pathname === "/painel" || pathname === "/recuperar" || pathname.startsWith("/recuperar/") || pathname.startsWith("/convite/")) return NextResponse.next();
  if (!hasSession) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webmanifest)$).*)"],
};
