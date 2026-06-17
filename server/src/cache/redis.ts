import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env.js";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

function isEnabled() {
  return env.CACHE_ENABLED && Boolean(env.REDIS_URL || env.REDIS_HOST);
}

function buildClient() {
  if (env.REDIS_URL) {
    return createClient({ url: env.REDIS_URL });
  }
  return createClient({
    socket: { host: env.REDIS_HOST ?? "127.0.0.1", port: env.REDIS_PORT ?? 6379 },
    username: env.REDIS_USERNAME,
    password: env.REDIS_PASSWORD,
    database: env.REDIS_DB ?? 0,
  });
}

export async function getRedisClient() {
  if (!isEnabled()) return null;
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    const next = buildClient();
    next.on("error", (err) => console.error("Redis error:", err.message));
    await next.connect();
    client = next as RedisClientType;
    connecting = null;
    return client;
  })();

  return connecting;
}

export async function closeRedisClient() {
  if (client?.isOpen) await client.quit();
  client = null;
  connecting = null;
}

export function isCacheEnabled() {
  return isEnabled();
}
