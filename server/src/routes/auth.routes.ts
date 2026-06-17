import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  login,
  logout,
  me,
  refresh,
  register,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controller.js";
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validators/auth.validator.js";

export const authRoutes = Router();

authRoutes.post("/register", authRateLimit, validate(registerSchema), register);
authRoutes.post("/login", authRateLimit, validate(loginSchema), login);
authRoutes.post("/refresh", authRateLimit, validate(refreshSchema), refresh);
authRoutes.post("/logout", authenticate, validate(logoutSchema), logout);
authRoutes.get("/me", authenticate, me);
authRoutes.post("/forgot-password", authRateLimit, validate(forgotPasswordSchema), forgotPassword);
authRoutes.post("/reset-password", authRateLimit, validate(resetPasswordSchema), resetPassword);
authRoutes.post("/change-password", authenticate, validate(changePasswordSchema), changePassword);
