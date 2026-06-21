import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url(),
  DATABASE_READ_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default("secritou-api"),
  JWT_AUDIENCE: z.string().default("secritou-web"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  REFRESH_COOKIE_NAME: z.string().default("secritou_refresh"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  CONTACT_RECEIVER_EMAIL: z.string().email().default("hello@secritou.com"),
  OPENAI_API_KEY: z.string().optional(),
  METRICS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),
  METRICS_PATH: z.string().default("/metrics"),
  METRICS_TOKEN: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().optional(),
  CACHE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  JOBS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
  S3_PUBLIC_ACL: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  UPLOAD_MAX_BYTES: z.coerce.number().default(20 * 1024 * 1024),
  SENTRY_DSN: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
