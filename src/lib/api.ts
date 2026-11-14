import { PilotError } from "@/lib/pilot/access";
import { NextResponse } from "next/server";

export function ok(data: any, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
export function fail(error: string, status = 400, extra?: any) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export function toStatus(e: any): number {
  if (e instanceof PilotError) return e.status;
  const m = String(e?.message || "");
  if (m === "UNAUTHORIZED") return 401;
  if (m === "FORBIDDEN") return 403;
  if (m === "NOT_FOUND") return 404;
  return 500;
}

export function apiError(error: unknown) {
  if (error instanceof PilotError) return fail(error.message, error.status, { code: error.code, resetsAt: error.resetsAt?.toISOString() });
  const status = toStatus(error);
  if (status === 500) console.error(JSON.stringify({ event: "api.error", type: (error as Error)?.name || "Error", code: (error as { code?: string })?.code }));
  return fail(status === 500 ? "The request could not be completed. Please try again or contact support." : String((error as Error)?.message || "Request failed"), status);
}
