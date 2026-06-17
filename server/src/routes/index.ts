import { Router } from "express";
import { createClient } from "redis";
import { prisma } from "../config/prisma.js";
import { authRoutes } from "./auth.routes.js";
import { contactRoutes } from "./contact.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import clientRoutes from "./client.routes.js";
import leadRoutes from "./lead.routes.js";
import projectRoutes from "./project.routes.js";
import taskRoutes from "./task.routes.js";
import companyRoutes from "./company.routes.js";
import freelancerRoutes from "./freelancer.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import serviceRequestRoutes from "./serviceRequest.routes.js";
import notificationRoutes from "./notification.routes.js";
import documentRoutes from "./document.routes.js";
import userRoutes from "./user.routes.js";
import searchRoutes from "./search.routes.js";
import aiRoutes from "./ai.routes.js";
import freelancerApplicationRoutes from "./freelancerApplication.routes.js";
import clientOnboardingRoutes from "./clientOnboarding.routes.js";

export const apiRoutes = Router();

// Health check
apiRoutes.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));

apiRoutes.get("/health/ready", async (_req, res) => {
  const checks: Record<string, string> = { api: "ok", database: "unknown", redis: "skipped" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    try {
      const redis = process.env.REDIS_URL
        ? createClient({ url: process.env.REDIS_URL })
        : createClient({
            socket: {
              host: process.env.REDIS_HOST ?? "127.0.0.1",
              port: Number(process.env.REDIS_PORT ?? 6379),
            },
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
            database: Number(process.env.REDIS_DB ?? 0),
          });
      await redis.connect();
      const pong = await redis.ping();
      checks.redis = pong === "PONG" ? "ok" : "error";
      await redis.quit();
    } catch {
      checks.redis = "error";
    }
  }

  const healthy = checks.database === "ok" && checks.redis !== "error";
  res.status(healthy ? 200 : 503).json({ data: { status: healthy ? "ready" : "degraded", checks } });
});

// Public routes
apiRoutes.use("/contact", contactRoutes);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/dashboard", dashboardRoutes);
apiRoutes.use("/freelancer-applications", freelancerApplicationRoutes);
apiRoutes.use("/client-onboardings", clientOnboardingRoutes);

// Protected MVP routes
apiRoutes.use("/companies", companyRoutes);
apiRoutes.use("/projects", projectRoutes);
apiRoutes.use("/tasks", taskRoutes);
apiRoutes.use("/clients", clientRoutes);
apiRoutes.use("/leads", leadRoutes);
apiRoutes.use("/notifications", notificationRoutes);
apiRoutes.use("/documents", documentRoutes);
apiRoutes.use("/users", userRoutes);

// Freelancer & Mission routes
apiRoutes.use("/freelancers", freelancerRoutes);

// Analytics routes
apiRoutes.use("/analytics", analyticsRoutes);

// Service Request routes
apiRoutes.use("/service-requests", serviceRequestRoutes);

// Search & AI routes
apiRoutes.use("/search", searchRoutes);
apiRoutes.use("/ai", aiRoutes);
