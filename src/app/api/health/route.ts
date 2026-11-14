import IORedis from "ioredis";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
let redis: IORedis | undefined;
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    if (process.env.NODE_ENV === "production") {
      if (!process.env.REDIS_URL) throw new Error("Redis unavailable");
      if (!redis) {
        redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000, commandTimeout: 2000, lazyConnect: true });
        redis.on("error", () => {});
      }
      const heartbeat = Number(await redis.get("worker:heartbeat"));
      if (!heartbeat || Date.now() - heartbeat > 60000) throw new Error("Worker unavailable");
      const oldest = await prisma.crawl.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
      if (oldest && Date.now() - oldest.createdAt.getTime() > 30 * 60000) throw new Error("Queue delayed");
    }
    return Response.json({ status: "ok" });
  } catch { return Response.json({ status: "unavailable" }, { status: 503 }); }
}
