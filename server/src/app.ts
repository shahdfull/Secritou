import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { loggingMiddleware } from "./middlewares/logging.middleware.js";
import { metricsAuthMiddleware } from "./middlewares/metricsAuth.middleware.js";
import { enforceMustChangePassword } from "./middlewares/mustChangePassword.middleware.js";
import { metricsMiddleware } from "./observability/middleware.js";
import { metricsHandler, metricsRoutes } from "./observability/routes.js";
import { apiRoutes } from "./routes/index.js";
import { swaggerSpec } from "./swagger.js";

export const app = express();

const isDevelopment = process.env.NODE_ENV !== "production";
if (!isDevelopment) {
  app.set("trust proxy", 1);
}
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https:",
          ...(isDevelopment ? ["http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*"] : []),
        ],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    xFrameOptions: { action: "deny" },
    xContentTypeOptions: true,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    strictTransportSecurity: isDevelopment
      ? false
      : {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
  }),
);

// Compress JSON/text responses. Registered right after helmet, before routes.
app.use(
  compression({
    level: 6, // balanced speed vs ratio
    threshold: 1024, // only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(metricsMiddleware);
app.use(loggingMiddleware);

if (env.METRICS_ENABLED) {
  app.get(env.METRICS_PATH, metricsAuthMiddleware, metricsHandler);
}

// Swagger/OpenAPI documentation
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve);
  app.get("/api-docs", swaggerUi.setup(swaggerSpec, { swaggerOptions: { defaultModelsExpandDepth: 1 } }));
  app.get("/openapi.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

// Baseline DDoS protection : specific limiters (authRateLimit, aiRateLimit, etc.) remain in place
app.use("/api/", rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
}));

// Enforce mustChangePassword server-side on all authenticated routes.
// Routes without authenticate middleware (login, register, refresh, forgot-password,
// reset-password) have req.user = undefined so the check is a no-op there.
// POST /auth/change-password is explicitly exempted so the user can actually fix it.
app.use("/api/v1", (req, res, next) => {
  if (req.method === "POST" && req.path === "/auth/change-password") return next();
  enforceMustChangePassword(req, res, next);
});

app.use("/api/v1", apiRoutes);
app.use("/api/v1/metrics", metricsRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorMiddleware);
