import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

export const rateLimitKeyGenerator = (req: Request) =>
  `${ipKeyGenerator(req.ip ?? "unknown")}:${req.user?.sub ?? "anonymous"}`;

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  message: { message: "Too many authentication attempts, please try again later" },
});

// Refresh tokens are gated by the HTTP-only cookie — brute-force isn't a concern here.
// 30/15min is generous enough for normal SPA navigation while still limiting stolen-cookie replay.
export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  message: { message: "Too many token refresh attempts, please try again later" },
});

export const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { message: "Too many contact requests, please try again later" },
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  message: { message: "Too many AI requests, please slow down" },
});

export const sensitiveWriteRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  message: { message: "Too many requests, please slow down" },
});

// Public application form: tighter than sensitiveWriteRateLimit (10/min) since
// a genuine candidate submits at most once; 3/hour still allows a retry after
// a mistake without leaving room for a spam bot.
export const applicationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { message: "Too many applications submitted, please try again later" },
});

// Public analytics event ingestion: unlike contactRateLimit, a single visitor
// legitimately fires many events per session (page views, CTA clicks). Capped
// generously per-minute to blunt abuse while never rate-limiting normal browsing.
export const analyticsEventRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { message: "Too many analytics events, please slow down" },
});

// Public upload (cv/, portfolio/) on the Join-Us form — no auth, so rate-limited
// by IP. 3 uploads/hour is generous for a genuine candidate (CV + a few portfolio
// items) while still blocking automated storage-abuse scripts.
export const uploadPublicRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { message: "Too many file uploads, please try again later" },
});
