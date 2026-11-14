import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, openSync, closeSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const actor = vi.hoisted(() => ({ id: "", email: "" }));
vi.mock("@/lib/auth", async (original) => ({ ...await original<typeof import("@/lib/auth")>(),
  getSessionUser: async () => actor.id ? { id: actor.id, email: actor.email, name: "Pilot owner" } : null,
  createSession: vi.fn(),
}));
vi.mock("@/lib/email", async (original) => ({ ...await original<typeof import("@/lib/email")>(), sendReportEmail: vi.fn() }));
vi.mock("@/lib/security/ssrf", async (original) => ({ ...await original<typeof import("@/lib/security/ssrf")>(), assertUrlSafe: vi.fn(async (url: string) => new URL(url)) }));
vi.mock("@/lib/crawler/crawler", () => ({ crawlSite: vi.fn() }));
vi.mock("@/lib/jobs/queue", () => ({ enqueueCrawl: vi.fn(async () => {}) }));
let prisma: typeof import("@/lib/db").prisma;
let access: typeof import("@/lib/pilot/access");
let providers: typeof import("@/lib/pilot/providers");
let temp: string;
beforeAll(async () => {
  temp = mkdtempSync(path.join(tmpdir(), "seo-pilot-tests-"));
  const database = process.env.TEST_DATABASE_URL || `file:${path.join(temp, "test.db")}`;
  if (!database.startsWith("file:") && !new URL(database).pathname.endsWith("_test")) throw new Error("Integration tests require a dedicated database whose name ends in _test");
  process.env.DATABASE_URL = database;
  vi.stubEnv("NODE_ENV", "test");
  delete process.env.REDIS_URL;
  if (database.startsWith("file:")) closeSync(openSync(database.slice(5), "a"));
  const schema = database.startsWith("file:") ? "prisma/schema.prisma" : "prisma/schema.production.prisma";
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--schema", schema, "--skip-generate"], { env: process.env, stdio: "pipe" });
  ({ prisma } = await import("@/lib/db")); access = await import("@/lib/pilot/access"); providers = await import("@/lib/pilot/providers");
}, 30000);
afterAll(async () => { await prisma?.$disconnect(); if (temp) rmSync(temp, { recursive: true, force: true }); });
async function seed(kind = "trial", limit = 1) {
  const email = `${randomUUID()}@example.com`;
  const user = await prisma.user.create({ data: { email, passwordHash: "test-only" } });
  const org = await prisma.organization.create({ data: { name: "Test workspace" } });
  await prisma.membership.create({ data: { userId: user.id, organizationId: org.id } });
  const period = await prisma.accessPeriod.create({ data: { organizationId: org.id, kind, startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86400000), auditLimit: limit, draftLimit: 5 } });
  const project = await prisma.project.create({ data: { organizationId: org.id, name: "Example", websiteUrl: "https://example.com/", renderMode: "html" } });
  return { user, org, period, project };
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
describe("pilot accounts and durable limits", () => {
  it("allows only one concurrent reservation for the last audit and refunds a failure exactly once", async () => {
    const data = await seed();
    const results = await Promise.allSettled(["first", "second"].map((key) => access.transaction((tx) => access.reserveUsage(tx, data.org.id, "audit", `${key}:${data.org.id}`))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const reservation = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>;
    expect((await prisma.accessPeriod.findUniqueOrThrow({ where: { id: data.period.id } })).auditsUsed).toBe(1);
    await access.settleUsage(reservation.value.id, false); await access.settleUsage(reservation.value.id, false);
    expect((await prisma.accessPeriod.findUniqueOrThrow({ where: { id: data.period.id } })).auditsUsed).toBe(0);
  });
  it("rejects expired and suspended access but keeps account details readable", async () => {
    const data = await seed(); actor.id = data.user.id; actor.email = data.user.email;
    await prisma.accessPeriod.update({ where: { id: data.period.id }, data: { endsAt: new Date(Date.now() - 100) } });
    await expect(access.currentAccess(prisma, data.org.id)).rejects.toMatchObject({ code: "ACCESS_EXPIRED" });
    const account = await import("@/app/api/account/route");
    const response = await account.GET(); expect(response.status).toBe(200); expect((await response.json()).data.status).toBe("expired");
    await prisma.organization.update({ where: { id: data.org.id }, data: { suspended: true } });
    await expect(access.currentAccess(prisma, data.org.id)).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
  });
  it("requires paid access for monitoring", async () => {
    const data = await seed();
    await expect(access.requirePaid(prisma, data.org.id)).rejects.toMatchObject({ code: "PAID_ACCESS_REQUIRED" });
  });
  it("does not oversubscribe provider budgets and retains uncertain charges", async () => {
    const data = await seed("paid");
    process.env.AI_MONTHLY_COST_CAP_USD = "0.25";
    const call = await providers.reserveProvider("ai", data.org.id, 250000);
    await expect(providers.reserveProvider("ai", data.org.id, 1)).rejects.toMatchObject({ code: "PROVIDER_BUDGET_REACHED" });
    await providers.settleProvider(call.id);
    expect((await prisma.budgetBucket.findUniqueOrThrow({ where: { id: call.bucketId } })).used).toBe(250000);
    expect((await prisma.providerCall.findUniqueOrThrow({ where: { id: call.id } })).status).toBe("unknown");
    process.env.AI_MONTHLY_COST_CAP_USD = "5";
  });
  it("reconciles known provider costs idempotently", async () => {
    const data = await seed("paid");
    const call = await providers.reserveProvider("ai", data.org.id, 250000);
    await providers.settleProvider(call.id, 1000, 50); await providers.settleProvider(call.id, 1000, 50);
    expect((await prisma.budgetBucket.findUniqueOrThrow({ where: { id: call.bucketId } })).used).toBe(1000);
  });
  it("clamps calendar-month renewal at the end of short months", () => {
    expect(access.addCalendarMonth(new Date("2027-01-31T10:00:00Z")).toISOString()).toBe("2027-02-28T10:00:00.000Z");
  });
  it("rejects cross-customer access to projects, audits, reports, actions and drafts", async () => {
    const a = await seed(), b = await seed(); actor.id = a.user.id; actor.email = a.user.email;
    const crawl = await prisma.crawl.create({ data: { projectId: b.project.id, status: "completed", scoreVersion: 2 } });
    const issue = await prisma.sEOIssue.create({ data: { crawlId: crawl.id, type: "missing_title", severity: "high", title: "Missing title", whatWrong: "Missing", whyMatters: "Clarity", recommendation: "Add a title", affectedUrls: JSON.stringify(["https://example.com/"]) } });
    const action = await prisma.aIAction.create({ data: { crawlId: crawl.id, issueId: issue.id, kind: "title_fix", status: "approved", proposedValue: "Title" } });
    const routes = [
      [await import("@/app/api/projects/[id]/route"), "GET", b.project.id],
      [await import("@/app/api/crawls/[id]/route"), "GET", crawl.id],
      [await import("@/app/api/projects/[id]/report/route"), "GET", b.project.id],
      [await import("@/app/api/projects/[id]/actions/route"), "GET", b.project.id],
      [await import("@/app/api/issues/[id]/generate-fix/route"), "POST", issue.id],
      [await import("@/app/api/actions/[id]/mark-implemented/route"), "POST", action.id],
      [await import("@/app/api/actions/[id]/approve/route"), "POST", action.id],
      [await import("@/app/api/actions/[id]/reject/route"), "POST", action.id],
      [await import("@/app/api/actions/[id]/route"), "PATCH", action.id],
    ] as const;
    for (const [route, method, id] of routes) {
      const response = await (route as any)[method](new Request(`https://app.example.com/api/test/${id}`, { method }), params(id));
      expect(response.status).toBe(403);
    }
  });
  it("turns an approved manual fix into reported, without claiming it is verified", async () => {
    const data = await seed(); actor.id = data.user.id; actor.email = data.user.email;
    const crawl = await prisma.crawl.create({ data: { projectId: data.project.id, status: "completed", scoreVersion: 2 } });
    const action = await prisma.aIAction.create({ data: { crawlId: crawl.id, kind: "title_fix", status: "approved" } });
    const route = await import("@/app/api/actions/[id]/mark-implemented/route");
    const response = await route.POST(new Request("https://app.example.com", { method: "POST" }), params(action.id));
    const result = await response.json(); expect(result.data.status).toBe("reported_updated"); expect(result.data.verifiedAt).toBeNull();
  });
  it("blocks public approval and publishing routes regardless of legacy settings", async () => {
    const share = await import("@/app/api/share/[token]/route"); expect((await share.GET()).status).toBe(403);
    const apply = await import("@/lib/cms");
    const result = await apply.applyAction({ actionId: "a", projectId: "p", websiteUrl: "https://example.com", kind: "title_fix", currentValue: null, proposedValue: "New title", targetUrls: [], payload: null }, { cmsAdapter: "wordpress" });
    expect(result.applied).toBe(false); expect(result.adapter).toBe("manual");
  });
  it("consumes an invitation atomically, binds its email and rolls back invalid signup", async () => {
    const { invitationHash, invitationToken } = await import("@/lib/pilot/invitations");
    const token = invitationToken(), email = `${randomUUID()}@example.com`;
    await prisma.invitation.create({ data: { email, tokenHash: invitationHash(token), expiresAt: new Date(Date.now() + 60000) } });
    const route = await import("@/app/api/auth/signup/route");
    const signup = (address: string) => route.POST(new Request("https://app.example.com/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "1.1.1.1" }, body: JSON.stringify({ email: address, token, password: "a secure test password" }) }));
    expect((await signup(`wrong-${email}`)).status).toBe(403);
    expect((await prisma.invitation.findUniqueOrThrow({ where: { tokenHash: invitationHash(token) } })).consumedAt).toBeNull();
    expect((await signup(email)).status).toBe(201); expect((await signup(email)).status).toBe(403);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
    expect((await access.currentAccess(prisma, membership.organizationId))).toMatchObject({ kind: "trial", auditLimit: 1, draftLimit: 5 });
  });
  it("uses one active crawl and reserves only one audit for simultaneous starts", async () => {
    const data = await seed("paid", 8);
    const { requestCrawl } = await import("@/lib/jobs/submit");
    const results = await Promise.all([requestCrawl(data.project.id, data.user.id), requestCrawl(data.project.id, data.user.id)]);
    expect(results[0].id).toBe(results[1].id);
    expect((await prisma.accessPeriod.findUniqueOrThrow({ where: { id: data.period.id } })).auditsUsed).toBe(1);
  });
  it("commits an audit once and safely ignores duplicate worker deliveries", async () => {
    const data = await seed("paid", 8);
    const { requestCrawl } = await import("@/lib/jobs/submit");
    const crawl = await requestCrawl(data.project.id, data.user.id);
    const { parseHtml } = await import("@/lib/crawler/parser");
    const page = parseHtml({ url: data.project.websiteUrl, finalUrl: data.project.websiteUrl, statusCode: 200, contentType: "text/html", html: "<html><head><title>A useful business website title for visitors</title></head><body><h1>Example business</h1><p>Helpful information</p></body></html>", sizeBytes: 500, loadMs: 100, depth: 0, redirectChain: [] });
    const crawler = await import("@/lib/crawler/crawler");
    vi.mocked(crawler.crawlSite).mockResolvedValue({ pages: [page], errors: [], coverage: { attempted: 1, audited: 1, discovered: 1, blocked: 0, failed: 0, limited: false, partial: false, mode: "html" } });
    const jobs = await vi.importActual<typeof import("@/lib/jobs/queue")>("@/lib/jobs/queue");
    await jobs.runCrawlJob(crawl.id); await jobs.runCrawlJob(crawl.id);
    expect(await prisma.report.count({ where: { crawlId: crawl.id } })).toBe(1);
    expect((await prisma.crawl.findUniqueOrThrow({ where: { id: crawl.id } })).status).toBe("completed");
    expect((await prisma.usageReservation.findUniqueOrThrow({ where: { id: crawl.reservationId! } })).status).toBe("committed");
  });
  it("propagates worker failures for retry and returns allowance after the final failure", async () => {
    const data = await seed("paid", 8);
    const { requestCrawl } = await import("@/lib/jobs/submit");
    const crawl = await requestCrawl(data.project.id, data.user.id);
    const crawler = await import("@/lib/crawler/crawler"); vi.mocked(crawler.crawlSite).mockRejectedValue(new Error("Upstream unavailable"));
    const jobs = await vi.importActual<typeof import("@/lib/jobs/queue")>("@/lib/jobs/queue");
    await expect(jobs.runCrawlJob(crawl.id, false)).rejects.toThrow("Upstream unavailable");
    expect((await prisma.crawl.findUniqueOrThrow({ where: { id: crawl.id } })).status).toBe("queued");
    await expect(jobs.runCrawlJob(crawl.id, true)).rejects.toThrow("Upstream unavailable");
    expect((await prisma.accessPeriod.findUniqueOrThrow({ where: { id: data.period.id } })).auditsUsed).toBe(0);
    expect((await prisma.crawl.findUniqueOrThrow({ where: { id: crawl.id } })).activeProjectId).toBeNull();
  });

  it("persists edits before review and prevents editing approved fixes", async () => {
    const data = await seed(); actor.id = data.user.id; actor.email = data.user.email;
    const crawl = await prisma.crawl.create({ data: { projectId: data.project.id, status: "completed" } });
    const action = await prisma.aIAction.create({ data: { crawlId: crawl.id, kind: "title_fix", status: "awaiting_approval", proposedValue: "Original" } });
    const route = await import("@/app/api/actions/[id]/route");
    const request = () => new Request("https://app.example.com", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposedValue: "Edited title" }) });
    expect((await route.PATCH(request(), params(action.id))).status).toBe(200);
    expect((await prisma.aIAction.findUniqueOrThrow({ where: { id: action.id } })).proposedValue).toBe("Edited title");
    await prisma.aIAction.update({ where: { id: action.id }, data: { status: "approved" } });
    expect((await route.PATCH(request(), params(action.id))).status).toBe(409);
  });
  it("enforces the one-site limit during simultaneous creation requests", async () => {
    const data = await seed("paid", 8); actor.id = data.user.id; actor.email = data.user.email;
    await prisma.project.delete({ where: { id: data.project.id } });
    const route = await import("@/app/api/projects/route");
    const request = () => new Request("https://app.example.com/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteUrl: "https://example.com", renderMode: "html" }) });
    const results = await Promise.all([route.POST(request()), route.POST(request())]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.project.count({ where: { organizationId: data.org.id } })).toBe(1);
  });
  it("makes queue outages visible and refunds the audit allowance", async () => {
    const data = await seed("paid", 8);
    const { enqueueCrawl } = await import("@/lib/jobs/queue"); vi.mocked(enqueueCrawl).mockRejectedValueOnce(new Error("Redis unavailable"));
    const { requestCrawl } = await import("@/lib/jobs/submit");
    await expect(requestCrawl(data.project.id, data.user.id)).rejects.toThrow("Redis unavailable");
    const crawl = await prisma.crawl.findFirstOrThrow({ where: { projectId: data.project.id } });
    expect(crawl.status).toBe("failed"); expect(crawl.activeProjectId).toBeNull();
    expect((await prisma.accessPeriod.findUniqueOrThrow({ where: { id: data.period.id } })).auditsUsed).toBe(0);
  });
  it("reserves daily AI tokens atomically and rolls back a rejected money reservation", async () => {
    const data = await seed("paid"); process.env.AI_DAILY_TOKEN_CAP = "100";
    const call = await providers.reserveProvider("ai", data.org.id, 250000, 80);
    await expect(providers.reserveProvider("ai", data.org.id, 250000, 80)).rejects.toMatchObject({ code: "PROVIDER_BUDGET_REACHED" });
    expect((await prisma.budgetBucket.findUniqueOrThrow({ where: { id: call.bucketId } })).used).toBe(250000);
    await providers.settleProvider(call.id, 500, 40);
    expect((await prisma.budgetBucket.findUniqueOrThrow({ where: { id: call.tokenBucketId! } })).used).toBe(40);
    process.env.AI_DAILY_TOKEN_CAP = "500000";
  });

  it("emails only new completed reports and suppresses duplicate deliveries", async () => {
    const data = await seed("paid");
    const crawl = await prisma.crawl.create({ data: { projectId: data.project.id, status: "completed", scoreVersion: 2 } });
    await prisma.report.create({ data: { projectId: data.project.id, crawlId: crawl.id, summary: JSON.stringify({ overall: 80 }), markdown: "Audit report" } });
    const schedule = await prisma.reportSchedule.create({ data: { projectId: data.project.id, email: data.user.email, frequency: "weekly" } });
    const email = await import("@/lib/email"); vi.mocked(email.sendReportEmail).mockReset().mockResolvedValue({ sent: true, mode: "resend", message: "Sent" });
    const { sendScheduleNow } = await import("@/lib/email/send-schedule");
    expect((await sendScheduleNow(schedule.id)).sent).toBe(true);
    expect((await sendScheduleNow(schedule.id)).sent).toBe(false);
    expect(email.sendReportEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(email.sendReportEmail).mock.calls[0][0].idempotencyKey).toBeTruthy();
  });
  it("does not retry uncertain email delivery outside the provider idempotency window", async () => {
    const data = await seed("paid");
    const crawl = await prisma.crawl.create({ data: { projectId: data.project.id, status: "completed", scoreVersion: 2 } });
    const report = await prisma.report.create({ data: { projectId: data.project.id, crawlId: crawl.id, summary: "{}" } });
    const schedule = await prisma.reportSchedule.create({ data: { projectId: data.project.id, email: data.user.email } });
    await prisma.emailDelivery.create({ data: { key: `report:${schedule.id}:${report.id}`, organizationId: data.org.id, scheduleId: schedule.id, reportId: report.id, createdAt: new Date(Date.now() - 2 * 86400000) } });
    const email = await import("@/lib/email"); vi.mocked(email.sendReportEmail).mockReset();
    const { sendScheduleNow } = await import("@/lib/email/send-schedule");
    expect((await sendScheduleNow(schedule.id)).message).toContain("operator review");
    expect(email.sendReportEmail).not.toHaveBeenCalled();
  });

});
