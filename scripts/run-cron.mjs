const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!baseUrl || !secret) {
  throw new Error("APP_URL and CRON_SECRET are required to run scheduled tasks");
}

for (const endpoint of ["reports", "rescan"]) {
  const response = await fetch(`${baseUrl}/api/cron/${endpoint}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${endpoint} cron failed (${response.status}): ${body}`);
  console.info(`[cron] ${endpoint}: ${body}`);
}
