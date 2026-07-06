import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@secritou/shared";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),
    name: z.string().min(2),
  }),
});

// PASSWORD_MIN_LENGTH must stay aligned with client/src/features/auth/LoginPage.tsx (loginSchema).
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(20).optional(),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(20).optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    newPassword: z.string().min(8),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  }),
});
