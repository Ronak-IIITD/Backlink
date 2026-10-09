import { Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/db";
import { runCrawlJob } from "@/lib/jobs/queue";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required to run the crawl worker");

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const concurrency = Math.max(1, Number.parseInt(process.env.CRAWL_WORKER_CONCURRENCY || "2", 10) || 2);
const worker = new Worker<{ crawlId: string }>(
  "crawl",
  async (job) => runCrawlJob(job.data.crawlId),
  { connection, concurrency }
);

worker.on("completed", (job) => console.info(`[worker] crawl job completed: ${job.data.crawlId}`));
worker.on("failed", (job, error) => console.error(`[worker] crawl job failed: ${job?.data.crawlId || "unknown"}`, error));
worker.on("error", (error) => console.error("[worker] error", error));
console.info(`[worker] crawl worker ready (concurrency ${concurrency})`);

async function shutdown() {
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
