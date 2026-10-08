import crypto from "node:crypto";
import { prisma } from "@/lib/db";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_ROOT = "https://www.googleapis.com/webmasters/v3/sites";

function secret() {
  const value = process.env.SESSION_SECRET || "";
  if (value.length < 32) throw new Error("SESSION_SECRET must be >= 32 chars");
  return value;
}

function redirectUri(origin: string) {
  return process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI || `${origin}/api/integrations/search-console/callback`;
}

function oauthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function createSearchConsoleAuthorizationUrl(projectId: string, siteUrl: string, userId: string, origin: string) {
  if (!oauthConfigured()) throw new Error("Search Console integration is not configured");
  const payload = Buffer.from(JSON.stringify({ projectId, siteUrl, userId, exp: Date.now() + 10 * 60_000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: `${payload}.${signature}`,
  }).toString();
  return url.toString();
}

export function verifySearchConsoleState(state: string) {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid authorization state");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("Invalid authorization state");
  const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!value.projectId || !value.userId || !value.siteUrl || value.exp < Date.now()) throw new Error("Authorization request expired");
  return value as { projectId: string; siteUrl: string; userId: string; exp: number };
}

function encryptionKey() {
  return crypto.createHash("sha256").update(`search-console:${secret()}`).digest();
}

export function encryptRefreshToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptRefreshToken(value: string) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !data) throw new Error("Stored Search Console credentials are invalid");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function exchangeCode(code: string, origin: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Google authorization failed");
  return data as { refresh_token?: string };
}

export async function saveSearchConsoleConnection(projectId: string, siteUrl: string, code: string, origin: string) {
  const tokens = await exchangeCode(code, origin);
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Revoke this app in your Google account and connect again.");
  await prisma.searchConsoleConnection.upsert({
    where: { projectId },
    create: { projectId, siteUrl, refreshTokenCiphertext: encryptRefreshToken(tokens.refresh_token) },
    update: { siteUrl, refreshTokenCiphertext: encryptRefreshToken(tokens.refresh_token), connectedAt: new Date() },
  });
}

async function accessToken(refreshTokenCiphertext: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: decryptRefreshToken(refreshTokenCiphertext),
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Could not refresh Search Console access");
  return data.access_token as string;
}

type Row = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

async function query(token: string, siteUrl: string, startDate: string, endDate: string, dimensions: string[] = []) {
  const response = await fetch(`${API_ROOT}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: dimensions.length ? 1000 : 1 }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Search Console data could not be loaded");
  return (data.rows || []) as Row[];
}

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }

export async function getSearchConsoleData(projectId: string) {
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { projectId } });
  if (!connection) return null;
  const token = await accessToken(connection.refreshTokenCiphertext);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const currentStart = new Date(end);
  currentStart.setUTCDate(currentStart.getUTCDate() - 27);
  const previousEnd = new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - 27);
  const [current, previous, trend, queries, pages] = await Promise.all([
    query(token, connection.siteUrl, isoDate(currentStart), isoDate(end)),
    query(token, connection.siteUrl, isoDate(previousStart), isoDate(previousEnd)),
    query(token, connection.siteUrl, isoDate(currentStart), isoDate(end), ["date"]),
    query(token, connection.siteUrl, isoDate(currentStart), isoDate(end), ["query"]),
    query(token, connection.siteUrl, isoDate(currentStart), isoDate(end), ["page"]),
  ]);
  const empty = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const normalize = (row?: Row) => row ? {
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  } : empty;
  return {
    siteUrl: connection.siteUrl,
    connectedAt: connection.connectedAt,
    period: { startDate: isoDate(currentStart), endDate: isoDate(end), previousStartDate: isoDate(previousStart), previousEndDate: isoDate(previousEnd) },
    current: normalize(current[0]),
    previous: normalize(previous[0]),
    trend: trend.sort((a, b) => (a.keys?.[0] || "").localeCompare(b.keys?.[0] || "")).map((row) => ({ date: row.keys?.[0], ...normalize(row) })),
    queries: queries.slice(0, 10).map((row) => ({ query: row.keys?.[0], ...normalize(row) })),
    pages: pages.slice(0, 10).map((row) => ({ page: row.keys?.[0], ...normalize(row) })),
  };
}

export async function disconnectSearchConsole(projectId: string) {
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { projectId } });
  if (!connection) return;
  try {
    const refreshToken = decryptRefreshToken(connection.refreshTokenCiphertext);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {}
  await prisma.searchConsoleConnection.deleteMany({ where: { projectId } });
}

export function searchConsoleIsConfigured() { return oauthConfigured(); }
