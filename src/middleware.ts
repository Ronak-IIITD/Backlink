import { NextRequest, NextResponse } from "next/server";
/** Block cross-origin browser mutations; authenticated server/CLI requests may omit Origin. */
export function middleware(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return NextResponse.next();
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.next();
  let expected: string;
  try { expected = new URL(process.env.APP_URL || request.url).origin; }
  catch { return NextResponse.json({ ok: false, error: "Application URL is not configured." }, { status: 503 }); }
  if (origin !== expected) return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed.", code: "ORIGIN_REJECTED" }, { status: 403 });
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
