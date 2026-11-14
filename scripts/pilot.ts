import { writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { invitationHash, invitationToken } from "../src/lib/pilot/invitations";
import { addCalendarMonth, transaction } from "../src/lib/pilot/access";
import { deleteOrganization, recoverAbandonedWork } from "../src/lib/pilot/maintenance";

const [command, identifier, ...flags] = process.argv.slice(2);
const option = (name: string) => flags.find((flag) => flag.startsWith(`--${name}=`))?.slice(name.length + 3);
async function organization(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new Error("Account not found");
  const membership = await prisma.membership.findFirstOrThrow({ where: { userId: user.id, role: "owner" } });
  return { user, id: membership.organizationId };
}
async function main() {
  if (command === "invite") {
    if (!identifier || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) throw new Error("Usage: npm run pilot -- invite owner@example.com");
    const token = invitationToken(), email = identifier.toLowerCase();
    const invitation = await transaction(async (tx) => {
      if (await tx.user.findUnique({ where: { email } })) throw new Error("Account already exists");
      await tx.invitation.updateMany({ where: { email, consumedAt: null }, data: { expiresAt: new Date() } });
      const row = await tx.invitation.create({ data: { email, tokenHash: invitationHash(token), expiresAt: new Date(Date.now() + 7 * 86400000) } });
      await tx.auditLog.create({ data: { action: "pilot.invited", entity: "invitation", entityId: row.id } });
      return row;
    });
    const link = new URL("/signup", process.env.APP_URL || "http://localhost:3000");
    link.searchParams.set("token", token); link.searchParams.set("email", email);
    console.log(JSON.stringify({ invitationId: invitation.id, expiresAt: invitation.expiresAt, invitationUrl: link.href }, null, 2));
    return;
  }
  if (command === "recover") { console.log(await recoverAbandonedWork()); return; }
  if (!identifier) throw new Error("Usage: npm run pilot -- invite|activate|suspend|resume|status|export|delete EMAIL [--reference=INVOICE] [--output=FILE] [--confirm-org=ID]");
  const account = await organization(identifier);
  if (command === "activate") {
    const reference = option("reference");
    if (!reference) throw new Error("Confirm payment externally, then provide --reference=INVOICE-ID");
    const period = await transaction(async (tx) => {
      const latest = await tx.accessPeriod.findFirst({ where: { organizationId: account.id, kind: "paid" }, orderBy: { endsAt: "desc" } });
      const now = new Date(), startsAt = latest && latest.endsAt > now ? latest.endsAt : now;
      // Repeated operator commands for one invoice must not grant extra paid months.
      const prior = await tx.auditLog.findFirst({ where: { action: "pilot.activated", entityId: account.id, meta: JSON.stringify({ reference }) } });
      if (prior) throw new Error("This payment reference has already been activated");
      const row = await tx.accessPeriod.create({ data: { organizationId: account.id, kind: "paid", startsAt, endsAt: addCalendarMonth(startsAt), auditLimit: 8, draftLimit: 50 } });
      await tx.organization.update({ where: { id: account.id }, data: { suspended: false } });
      await tx.auditLog.create({ data: { action: "pilot.activated", entity: "organization", entityId: account.id, meta: JSON.stringify({ reference }) } });
      return row;
    });
    console.log(JSON.stringify(period, null, 2)); return;
  }
  if (["suspend", "resume"].includes(command)) {
    await transaction(async (tx) => {
      await tx.organization.update({ where: { id: account.id }, data: { suspended: command === "suspend" } });
      await tx.auditLog.create({ data: { action: `pilot.${command}`, entity: "organization", entityId: account.id } });
    });
    console.log(`Account ${command === "suspend" ? "suspended" : "resumed"}`); return;
  }
  if (command === "status") {
    const [org, periods, usage, projects] = await Promise.all([
      prisma.organization.findUnique({ where: { id: account.id } }),
      prisma.accessPeriod.findMany({ where: { organizationId: account.id }, orderBy: { startsAt: "desc" } }),
      prisma.providerCall.groupBy({ by: ["provider", "status"], where: { organizationId: account.id }, _sum: { charged: true, reserved: true, tokens: true } }),
      prisma.project.findMany({ where: { organizationId: account.id }, select: { id: true, name: true, renderMode: true, crawls: { take: 5, orderBy: { createdAt: "desc" }, select: { id: true, status: true, coverage: true, createdAt: true, error: true } } } }),
    ]);
    console.log(JSON.stringify({ organization: org, periods, usage, projects }, null, 2)); return;
  }
  if (command === "export") {
    const output = option("output"); if (!output) throw new Error("Provide --output=FILE.json");
    const projects = await prisma.project.findMany({ where: { organizationId: account.id }, include: { crawls: { include: { pages: true, issues: true, recommendations: true } }, reports: true, keywords: true } });
    const ids = projects.flatMap((p) => p.crawls.map((crawl) => crawl.id));
    const data = { account: { email: account.user.email, name: account.user.name }, projects: projects.map(({ cmsWebhookSecret: _secret, ...project }) => project),
      actions: await prisma.aIAction.findMany({ where: { crawlId: { in: ids } } }) };
    await writeFile(output, JSON.stringify(data, null, 2), { mode: 0o600, flag: "wx" });
    await prisma.auditLog.create({ data: { action: "pilot.exported", entity: "organization", entityId: account.id } });
    console.log("Export written without authentication or integration secrets"); return;
  }
  if (command === "delete") {
    if (option("confirm-org") !== account.id) throw new Error(`Re-run with --confirm-org=${account.id} to confirm this workspace deletion`);
    await deleteOrganization(account.id, "Customer support deletion request"); console.log("Workspace deleted"); return;
  }
  throw new Error("Unknown pilot command");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Pilot command failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
