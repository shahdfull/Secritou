import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { parseDurationToMs } from "./parseDuration.js";

const COOKIE_PATH = "/";

export function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(env.REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
  });
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(env.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: COOKIE_PATH,
  });
}

export function getRefreshTokenFromRequest(req: Request): string | undefined {
  const cookieToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
  const bodyToken = req.body?.refreshToken;
  return (typeof cookieToken === "string" && cookieToken) || (typeof bodyToken === "string" && bodyToken) || undefined;
}
