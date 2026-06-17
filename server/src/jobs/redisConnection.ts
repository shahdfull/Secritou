import * as IORedis from "ioredis";
import { env } from "../config/env.js";

const Redis = (IORedis as any).default ?? IORedis;

let connection: InstanceType<typeof Redis> | null = null;

export function getBullRedisConnection() {
  if (connection) return connection;

  if (env.REDIS_URL) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    return connection;
  }

  connection = new Redis({
    host: env.REDIS_HOST ?? "127.0.0.1",
    port: env.REDIS_PORT ?? 6379,
    username: env.REDIS_USERNAME,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB ?? 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return connection;
}
