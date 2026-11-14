import { mkdir, open } from "node:fs/promises";
import path from "node:path";
const url = process.env.DATABASE_URL || "file:./dev.db";
if (!url.startsWith("file:")) throw new Error("db:push is for SQLite development. Use db:migrate:deploy for PostgreSQL.");
const filename = path.resolve("prisma", url.slice(5));
await mkdir(path.dirname(filename), { recursive: true });
await (await open(filename, "a", 0o600)).close();
