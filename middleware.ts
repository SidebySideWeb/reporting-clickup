import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";

// Password gate for every page and API route. Only /login and /api/login stay open.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!process.env.DASHBOARD_PASSWORD) {
    // Fail closed: a deployment without a password must never be public.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("DASHBOARD_PASSWORD is not set on this deployment.", { status: 503 });
    }
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  if (await verifySession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
