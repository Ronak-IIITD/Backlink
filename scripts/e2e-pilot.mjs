import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const base = new URL(process.env.E2E_BASE_URL || "http://127.0.0.1:3100");
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!["127.0.0.1", "localhost"].includes(base.hostname) || !databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("E2E requires a loopback app URL and dedicated *_test PostgreSQL database.");
const db = new PrismaClient({ datasourceUrl: databaseUrl });
let cookie = "";
async function request(path, method = "GET", body) {
  const response = await fetch(new URL(path, base), { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const session = response.headers.getSetCookie().find((value) => value.startsWith("seo_session="));
  if (session) cookie = session.split(";")[0];
  return { status: response.status, body: await response.json() };
}
const email = `e2e-${randomUUID()}@example.test`;
try {
  assert.equal((await request("/api/auth/signup", "POST", { email, password: "test password for the private pilot" })).status, 400);
  const token = randomBytes(32).toString("hex");
  await db.invitation.create({ data: { email, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60000) } });
  const signup = await request("/api/auth/signup", "POST", { email, token, password: "test password for the private pilot", name: "Pilot E2E" });
  assert.equal(signup.status, 201); assert.ok(cookie.startsWith("seo_session="));
  assert.equal((await request("/api/account")).body.data.status, "trial");
  const membership = await db.membership.findFirstOrThrow({ where: { userId: signup.body.data.id } });
  const project = await db.project.create({ data: { organizationId: membership.organizationId, name: "E2E Example", websiteUrl: "https://example.com/", renderMode: "html" } });
  const crawl = await db.crawl.create({ data: { projectId: project.id, status: "completed", scoreVersion: 2, startedAt: new Date(), finishedAt: new Date() } });
  await db.page.create({ data: { crawlId: crawl.id, url: project.websiteUrl, finalUrl: project.websiteUrl, contentType: "text/html", statusCode: 200, h1: "Example business", h1Count: 1, bodyText: "Example business services", wordCount: 200, robotsDirectives: "{}" } });
  const issue = await db.sEOIssue.create({ data: { crawlId: crawl.id, type: "missing_title", severity: "high", title: "Missing title", whatWrong: "No title tag", whyMatters: "Clarity in search results", recommendation: "Write a descriptive title", affectedUrls: JSON.stringify([project.websiteUrl]) } });
  const generated = await request(`/api/issues/${issue.id}/generate-fix`, "POST");
  assert.equal(generated.status, 201, JSON.stringify(generated.body));
  assert.equal(generated.body.data.status, "awaiting_approval");
  assert.deepEqual(JSON.parse(generated.body.data.payload).urls, [project.websiteUrl]);
  const id = generated.body.data.id;
  const edited = await request(`/api/actions/${id}`, "PATCH", { proposedValue: "A reviewed title for the example business website" });
  assert.equal(edited.body.data.proposedValue, "A reviewed title for the example business website");
  const forged = await fetch(new URL(`/api/actions/${id}/approve`, base), { method: "POST", headers: { Cookie: cookie, Origin: "https://other.example.com" } });
  assert.equal(forged.status, 403);
  assert.equal((await request(`/api/actions/${id}/approve`, "POST")).body.data.status, "approved");
  assert.equal((await request(`/api/actions/${id}/apply`, "POST")).status, 403);
  const reported = await request(`/api/actions/${id}/mark-implemented`, "POST");
  assert.equal(reported.body.data.status, "reported_updated"); assert.equal(reported.body.data.verifiedAt, null);
  assert.equal((await request(`/api/projects/${project.id}/auto-rescan`, "PATCH", { autoRescan: "weekly" })).status, 403);
  assert.equal((await request(`/api/projects/${project.id}/cms`, "PATCH", { cmsAdapter: "wordpress" })).status, 403);
  assert.equal((await request(`/api/projects/${project.id}/share`, "POST")).status, 403);
  assert.equal((await request("/api/account")).body.data.usage.drafts, 1);
  const resetToken = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({ data: { userId: signup.body.data.id, tokenHash: createHash("sha256").update(resetToken).digest("hex"), expiresAt: new Date(Date.now() + 60000) } });
  assert.equal((await request("/api/auth/password-reset/confirm", "POST", { token: resetToken, password: "a different secure password for testing" })).status, 200);
  assert.equal((await request(`/api/projects/${project.id}`)).status, 401);
  assert.equal((await request("/api/auth/password-reset/confirm", "POST", { token: resetToken, password: "a different secure password for testing" })).status, 400);
  assert.equal((await request("/api/auth/login", "POST", { email, password: "a different secure password for testing" })).status, 200);
  const previousCookie = cookie;
  assert.equal((await request("/api/auth/logout", "POST")).status, 200);
  assert.equal((await fetch(new URL(`/api/projects/${project.id}`, base), { headers: { Cookie: previousCookie } })).status, 401);
  assert.equal((await request(`/api/projects/${project.id}`)).status, 401);
  console.info("[e2e] Real session, invitation, account, draft, approval, manual handoff, and access gates passed.");
} finally { await db.$disconnect(); }
