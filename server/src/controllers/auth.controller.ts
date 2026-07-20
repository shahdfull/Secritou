import type { RequestHandler } from "express";
import { AuthService } from "../services/auth.service.js";
import {
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  setRefreshTokenCookie,
} from "../utils/authCookies.js";
import { cacheDel } from "../cache/cacheService.js";
import { cacheKeys } from "../cache/cacheKeys.js";
import { HttpError } from "../utils/httpError.js";

const authService = new AuthService();

function sendAuthResponse(
  res: Parameters<RequestHandler>[1],
  data: Awaited<ReturnType<AuthService["login"]>>,
  status = 200,
) {
  setRefreshTokenCookie(res, data.tokens.refreshToken);
  res.status(status).json({
    data: {
      user: data.user,
      tokens: { accessToken: data.tokens.accessToken },
    },
  });
}

export const register: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.register(req.body);
    sendAuthResponse(res, data, 201);
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.login(req.body);
    sendAuthResponse(res, data);
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      throw new HttpError(401, "Refresh token required", "REFRESH_TOKEN_REQUIRED");
    }
    const data = await authService.refresh(refreshToken);
    sendAuthResponse(res, data);
  } catch (error) {
    // A benign concurrent-rotation race (another tab refreshed first) leaves a
    // valid cookie in place — don't clear it, or we'd log the user out for a
    // race we deliberately tolerate. Every other failure clears the cookie.
    const code = (error as { code?: string })?.code;
    if (code !== "REFRESH_RACE") {
      clearRefreshTokenCookie(res);
    }
    next(error);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.me(req.user!.sub);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    if (req.user?.sub) {
      await cacheDel(cacheKeys.authMe(req.user.sub));
    }
    clearRefreshTokenCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    await authService.requestPasswordReset(req.body.email);
    res.json({ message: "If an account exists, a reset email has been sent" });
  } catch (error) {
    next(error);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    await authService.changePassword(
      req.user!.sub,
      req.body.currentPassword,
      req.body.newPassword
    );
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};
