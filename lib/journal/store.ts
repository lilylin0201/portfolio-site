import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { del } from "@vercel/blob";
import type { JournalDoc, StorageMode, Week, WeekMeta } from "./types";
import { isISODate, sortWeeksNewestFirst, weekTitle } from "./dates";

/*
 * Where things live
 * -----------------
 * Written text  -> Upstash Redis (free tier, via the Vercel Marketplace).
 *                  Cheap to autosave into, so typing never burns through limits.
 * Photos/videos -> Vercel Blob. Stored outside your deployments, so they do NOT
 *                  count toward the Deployment Storage that filled up before.
 *
 * On your laptop with neither set up, everything is saved in the
 * `.journal-data/` folder instead (ignored by git), so you can try it locally.
 */

const INDEX_KEY = "journal:weeks";
const weekKey = (id: string) => `journal:week:${id}`;

const LOCAL_DIR = path.join(process.cwd(), ".journal-data");
const LOCAL_WEEKS = path.join(LOCAL_DIR, "weeks");
export const LOCAL_MEDIA = path.join(LOCAL_DIR, "media");

export class SetupError extends Error {}

function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function textStorageMode(): StorageMode {
  return redisClient() ? "cloud" : "local";
}

export function mediaStorageMode(): StorageMode {
  return process.env.BLOB_READ_WRITE_TOKEN ? "cloud" : "local";
}

// Vercel's servers can't save files to disk, so local mode only works on your laptop.
export function setupProblems(): string[] {
  if (!process.env.VERCEL) return [];
  const problems: string[] = [];
  if (!redisClient()) problems.push("Connect an Upstash Redis database (Storage tab) so your writing can be saved.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) problems.push("Connect a Vercel Blob store (Storage tab) so photos and videos can be uploaded.");
  if (!process.env.JOURNAL_PASSWORD) problems.push("Add a JOURNAL_PASSWORD environment variable so only you can edit.");
  return problems;
}

function assertWritable() {
  if (process.env.VERCEL && !redisClient()) {
    throw new SetupError("Storage isn't connected yet. See the setup steps on the edit page.");
  }
}

function metaOf(week: Week): WeekMeta {
  const { id, title, startDate, published, createdAt, updatedAt } = week;
  return { id, title, startDate, published, createdAt, updatedAt };
}

/* ---------------- reading ---------------- */

async function readAllLocal(): Promise<Week[]> {
  try {
    const files = await fs.readdir(LOCAL_WEEKS);
    const weeks = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => JSON.parse(await fs.readFile(path.join(LOCAL_WEEKS, f), "utf8")) as Week),
    );
    return weeks;
  } catch {
    return [];
  }
}

export async function listWeeks(): Promise<WeekMeta[]> {
  const redis = redisClient();
  if (!redis) return sortWeeksNewestFirst((await readAllLocal()).map(metaOf));
  const all = await redis.hgetall<Record<string, WeekMeta>>(INDEX_KEY);
  return sortWeeksNewestFirst(Object.values(all ?? {}));
}

export async function getWeek(id: string): Promise<Week | null> {
  if (!isISODate(id)) return null;
  const redis = redisClient();
  if (!redis) {
    try {
      return JSON.parse(await fs.readFile(path.join(LOCAL_WEEKS, `${id}.json`), "utf8")) as Week;
    } catch {
      return null;
    }
  }
  return (await redis.get<Week>(weekKey(id))) ?? null;
}

/* ---------------- writing ---------------- */

async function writeWeek(week: Week): Promise<void> {
  assertWritable();
  const redis = redisClient();
  if (!redis) {
    await fs.mkdir(LOCAL_WEEKS, { recursive: true });
    await fs.writeFile(path.join(LOCAL_WEEKS, `${week.id}.json`), JSON.stringify(week, null, 2));
    return;
  }
  await redis.set(weekKey(week.id), week);
  await redis.hset(INDEX_KEY, { [week.id]: metaOf(week) });
}

type Content = { title?: unknown; doc?: unknown; html?: unknown };

function cleanContent(c: Content) {
  const doc = c.doc as JournalDoc | undefined;
  return {
    ...(typeof c.title === "string" && c.title.trim() ? { title: c.title.trim().slice(0, 120) } : {}),
    ...(doc && doc.type === "doc" ? { doc } : {}),
    ...(typeof c.html === "string" ? { html: c.html } : {}),
  };
}

// Every saved entry is public; there are no drafts.
export async function createWeek(startDate: string, content: Content): Promise<Week> {
  if (!isISODate(startDate)) throw new Error("That date doesn't look right.");
  if (await getWeek(startDate)) throw new Error("There's already an entry for that week.");
  const now = new Date().toISOString();
  const week: Week = {
    id: startDate,
    startDate,
    title: weekTitle(startDate),
    published: true,
    createdAt: now,
    updatedAt: now,
    doc: { type: "doc", content: [] },
    html: "",
    ...cleanContent(content),
  };
  await writeWeek(week);
  return week;
}

export async function updateWeek(id: string, content: Content): Promise<Week> {
  const existing = await getWeek(id);
  if (!existing) throw new Error("That entry doesn't exist anymore.");
  const week: Week = { ...existing, ...cleanContent(content), published: true, updatedAt: new Date().toISOString() };
  await writeWeek(week);
  // Photos you took out of the entry are deleted, so they stop using storage.
  const stillUsed = new Set(mediaUrlsIn(week.html + JSON.stringify(week.doc)));
  await deleteMedia(mediaUrlsIn(existing.html + JSON.stringify(existing.doc)).filter((u) => !stillUsed.has(u)));
  return week;
}

// Deleting an entry also deletes the photos/videos uploaded into it.
export async function deleteWeek(id: string): Promise<void> {
  assertWritable();
  const week = await getWeek(id);
  if (!week) return;
  await deleteMedia(mediaUrlsIn(week.html + JSON.stringify(week.doc)));
  const redis = redisClient();
  if (!redis) {
    await fs.rm(path.join(LOCAL_WEEKS, `${id}.json`), { force: true });
    return;
  }
  await redis.del(weekKey(id));
  await redis.hdel(INDEX_KEY, id);
}

// When you press Cancel, photos uploaded during that edit are thrown away
// (unless the saved entry already uses them).
export async function discardUploads(weekId: string, urls: unknown): Promise<void> {
  if (!Array.isArray(urls)) return;
  const week = isISODate(weekId) ? await getWeek(weekId) : null;
  const used = new Set(week ? mediaUrlsIn(week.html + JSON.stringify(week.doc)) : []);
  const candidates = mediaUrlsIn(urls.filter((u) => typeof u === "string").join(" "));
  await deleteMedia(candidates.filter((u) => !used.has(u)));
}

const BLOB_URL = /https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/journal\/[^"'\s)\\]+/gi;
const LOCAL_URL = /\/api\/journal\/media\/[\w.-]+/g;

function mediaUrlsIn(text: string): string[] {
  return Array.from(new Set([...(text.match(BLOB_URL) ?? []), ...(text.match(LOCAL_URL) ?? [])]));
}

async function deleteMedia(urls: string[]) {
  const blobUrls = urls.filter((u) => u.startsWith("https://"));
  if (blobUrls.length && process.env.BLOB_READ_WRITE_TOKEN) await del(blobUrls).catch(() => {});
  const localNames = urls.filter((u) => u.startsWith("/api/journal/media/")).map((u) => u.split("/").pop()!);
  await Promise.all(localNames.map((n) => fs.rm(path.join(LOCAL_MEDIA, n), { force: true }).catch(() => {})));
}
