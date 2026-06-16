import type { RequestHandler } from "express";
import { AuthService } from "../services/auth.service.js";

const authService = new AuthService();

export const register: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.register(req.body);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.login(req.body);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.refresh(req.body.refreshToken);
    res.json({ data });
  } catch (error) {
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
    await authService.logout(req.body.refreshToken);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    await authService.requestPasswordReset(req.body.email);
    res.json({ message: "Password reset email sent" });
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
