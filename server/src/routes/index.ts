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
import proposalRoutes from "./proposal.routes.js";
import approvalRoutes from "./approval.routes.js";
import invoiceRoutes from "./invoice.routes.js";
import enhancedDocumentRoutes from "./enhancedDocument.routes.js";
import clientSuccessRoutes from "./clientSuccess.routes.js";
import summaryRoutes from "./summary.routes.js";
import uploadRoutes from "./upload.routes.js";
import aiConversationRoutes from "./aiConversation.routes.js";
import customQuestionRoutes from "./customQuestion.routes.js";

export const apiRoutes = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [ok]
 */
apiRoutes.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check (database, redis, etc)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [ready, degraded]
 *                     checks:
 *                       type: object
 *                       properties:
 *                         api:
 *                           type: string
 *                           enum: [ok, error]
 *                         database:
 *                           type: string
 *                           enum: [ok, error, unknown]
 *                         redis:
 *                           type: string
 *                           enum: [ok, error, skipped]
 *       503:
 *         description: Service not ready
 */
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

// Freelancer profile routes
apiRoutes.use("/freelancers", freelancerRoutes);

// Analytics routes
apiRoutes.use("/analytics", analyticsRoutes);

// Service Request routes
apiRoutes.use("/service-requests", serviceRequestRoutes);

// Search & AI routes
apiRoutes.use("/search", searchRoutes);
apiRoutes.use("/ai", aiRoutes);

// Premium portal routes
apiRoutes.use("/proposals", proposalRoutes);
apiRoutes.use("/approvals", approvalRoutes);
apiRoutes.use("/invoices", invoiceRoutes);
apiRoutes.use("/enhanced-documents", enhancedDocumentRoutes);
apiRoutes.use("/client-success", clientSuccessRoutes);

// Summary routes (for performance optimizations)
apiRoutes.use("/summaries", summaryRoutes);

// File upload routes (authenticated, S3-backed)
apiRoutes.use("/upload", uploadRoutes);

// AI Conversation history routes
apiRoutes.use("/ai/conversations", aiConversationRoutes);

// Custom question (FAQ) routes
apiRoutes.use("/custom-questions", customQuestionRoutes);
