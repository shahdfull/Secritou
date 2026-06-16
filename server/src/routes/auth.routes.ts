import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { login, logout, me, refresh, register, forgotPassword, resetPassword } from "../controllers/auth.controller.js";
import { loginSchema, refreshSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/auth.validator.js";

export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), register);
authRoutes.post("/login", validate(loginSchema), login);
authRoutes.post("/refresh", validate(refreshSchema), refresh);
authRoutes.post("/logout", authenticate, validate(refreshSchema), logout);
authRoutes.get("/me", authenticate, me);
authRoutes.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
authRoutes.post("/reset-password", validate(resetPasswordSchema), resetPassword);
