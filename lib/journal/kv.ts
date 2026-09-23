import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient } from "redis";

/*
 * A tiny key-value layer that works with whichever Redis Vercel gives you:
 * - REDIS_URL (a regular Redis database from the Storage tab), or
 * - Upstash's KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*).
 * Values are stored as JSON text.
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
}

type NodeRedis = ReturnType<typeof createClient>;
// Reuse one connection per server instance instead of reconnecting on every request.
const globalForRedis = globalThis as unknown as { journalRedis?: Promise<NodeRedis> };

function nodeRedis(url: string): KV {
  const client = async () => {
    if (!globalForRedis.journalRedis) {
      const c = createClient({ url });
      c.on("error", (err) => console.error("Redis error", err));
      globalForRedis.journalRedis = c.connect().then(() => c as NodeRedis);
      globalForRedis.journalRedis.catch(() => (globalForRedis.journalRedis = undefined));
    }
    return globalForRedis.journalRedis;
  };
  const parse = <T>(raw: string | null | undefined): T | null => (raw == null ? null : (JSON.parse(raw) as T));
  return {
    async get<T>(key: string) {
      return parse<T>((await (await client()).get(key)) as string | null);
    },
    async set(key, value) {
      await (await client()).set(key, JSON.stringify(value));
    },
    async del(key) {
      await (await client()).del(key);
    },
    async hgetall<T>(key: string) {
      const raw = (await (await client()).hGetAll(key)) as Record<string, string>;
      return Object.fromEntries(Object.entries(raw ?? {}).map(([k, v]) => [k, JSON.parse(v) as T]));
    },
    async hset(key, field, value) {
      await (await client()).hSet(key, field, JSON.stringify(value));
    },
    async hdel(key, field) {
      await (await client()).hDel(key, field);
    },
  };
}

function upstash(url: string, token: string): KV {
  const r = new UpstashRedis({ url, token });
  return {
    async get<T>(key: string) {
      return (await r.get<T>(key)) ?? null;
    },
    async set(key, value) {
      await r.set(key, value);
    },
    async del(key) {
      await r.del(key);
    },
    async hgetall<T>(key: string) {
      return (await r.hgetall<Record<string, T>>(key)) ?? {};
    },
    async hset(key, field, value) {
      await r.hset(key, { [field]: value });
    },
    async hdel(key, field) {
      await r.hdel(key, field);
    },
  };
}

let cached: KV | null | undefined;

export function kv(): KV | null {
  if (cached !== undefined) return cached;
  const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (restUrl && restToken) cached = upstash(restUrl, restToken);
  else if (process.env.REDIS_URL || process.env.KV_URL) cached = nodeRedis((process.env.REDIS_URL || process.env.KV_URL)!);
  else cached = null;
  return cached;
}
