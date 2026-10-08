import { NextResponse } from "next/server";

export function ok(data: any, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
export function fail(error: string, status = 400, extra?: any) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export function toStatus(e: any): number {
  const m = String(e?.message || "");
  if (m === "UNAUTHORIZED") return 401;
  if (m === "FORBIDDEN") return 403;
  if (m === "NOT_FOUND") return 404;
  return 500;
}
