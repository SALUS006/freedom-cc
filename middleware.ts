import { NextResponse, type NextRequest } from "next/server";

// Light gate only: presence of the session cookie. Real verification happens in
// server components and route handlers (Node runtime) via getSession().
const PUBLIC_PREFIXES = [
  "/welcome",
  "/sign-in",
  "/register",
  "/create-club",
  "/admin/sign-in",
  "/forgot-password",
  "/reset-password",
  "/offline",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has("fcc_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
