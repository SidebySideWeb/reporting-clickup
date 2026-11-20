import { NextRequest, NextResponse } from "next/server";
import { COOKIE, decide, verifySession } from "@/lib/auth";

// Password gate for every page and API route. Only /login and /api/login stay open.
// _next and the favicon are excluded by the matcher below.
export async function middleware(req: NextRequest) {
  const d = decide({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    passwordSet: Boolean(process.env.DASHBOARD_PASSWORD),
    production: process.env.NODE_ENV === "production",
    sessionOk: await verifySession(req.cookies.get(COOKIE)?.value),
  });
  if (d.kind === "allow") return NextResponse.next();
  if (d.kind === "closed") return new NextResponse(d.message, { status: d.status });
  if (d.kind === "deny") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", d.next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
