const baseUrl = (process.env.SMOKE_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const checks = [
  ["homepage", "/"],
  ["login page", "/login"],
  ["signup page", "/signup"],
  ["forgot-password page", "/forgot-password"],
  ["reset-password page", "/reset-password"],
];

for (const [name, path] of checks) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  console.info(`[smoke] ${name}: ${response.status}`);
}

const health = await fetch(`${baseUrl}/api/health`, { redirect: "manual" });
const healthBody = await health.json().catch(() => null);
if (!health.ok || healthBody?.status !== "ok") {
  throw new Error(`health check failed (HTTP ${health.status})`);
}
console.info(`[smoke] health: ${health.status}`);

const session = await fetch(`${baseUrl}/api/auth/me`, { redirect: "manual" });
const sessionBody = await session.json().catch(() => null);
if (!session.ok || sessionBody?.ok !== true || !("user" in (sessionBody.data || {}))) {
  throw new Error(`session endpoint failed (HTTP ${session.status})`);
}
console.info(`[smoke] session endpoint: ${session.status}`);
