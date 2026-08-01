import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env.js";
import logger from "../utils/logger.js";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

function isEnabled() {
  return env.CACHE_ENABLED && Boolean(env.REDIS_URL || env.REDIS_HOST);
}

// SEC-084: connectTimeout alone bounds only a SINGLE connection attempt — the redis v4/v6 client's
// default reconnectStrategy retries indefinitely (exponential backoff) after that attempt fails,
// so connect() itself never actually rejects without also disabling it here. Confirmed by direct
// reproduction: with connectTimeout alone (no reconnectStrategy: false), a call against a stopped
// Redis container never resolved nor rejected even after several minutes. reconnectStrategy: false
// makes the client give up after the first failed attempt instead of retrying forever, so
// connect() rejects within connectTimeout and every caller's existing try/catch can proceed
// without the cache.
const REDIS_CONNECT_TIMEOUT_MS = 5000;
// connectTimeout only bounds connect() itself — a command sent on an ALREADY-open client (isOpen
// stayed true) whose socket dies mid-flight (container stopped after this client had connected,
// not before) hangs forever without this: confirmed by direct reproduction, stopping the container
// right as a request landed on an already-connected client left redis.ping() unresolved for over
// 15s with no timeout of its own to fall back on.
const REDIS_SOCKET_TIMEOUT_MS = 5000;

function buildClient() {
  if (env.REDIS_URL) {
    return createClient({
      url: env.REDIS_URL,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        reconnectStrategy: false,
        socketTimeout: REDIS_SOCKET_TIMEOUT_MS,
      },
    });
  }
  return createClient({
    socket: {
      host: env.REDIS_HOST ?? "127.0.0.1",
      port: env.REDIS_PORT ?? 6379,
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: false,
      socketTimeout: REDIS_SOCKET_TIMEOUT_MS,
    },
    username: env.REDIS_USERNAME,
    password: env.REDIS_PASSWORD,
    database: env.REDIS_DB ?? 0,
  });
}

export async function getRedisClient() {
  if (!isEnabled()) return null;
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  // SEC-084: connecting must be cleared on failure too — a rejected connect() left it pointing
  // forever at an already-rejected promise, so every subsequent call kept re-awaiting (and
  // re-rejecting from) that same stale attempt instead of trying again once Redis was reachable.
  connecting = (async () => {
    try {
      const next = buildClient();
      next.on("error", (err) => logger.error({ err }, "Redis error"));
      await next.connect();
      client = next as RedisClientType;
      return client;
    } finally {
      connecting = null;
    }
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
