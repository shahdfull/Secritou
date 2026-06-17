import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { loggingMiddleware } from "./middlewares/logging.middleware.js";
import { metricsAuthMiddleware } from "./middlewares/metricsAuth.middleware.js";
import { metricsMiddleware } from "./observability/middleware.js";
import { metricsHandler, metricsRoutes } from "./observability/routes.js";
import { apiRoutes } from "./routes/index.js";

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

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
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

app.use("/api/v1", apiRoutes);
app.use("/api/v1/metrics", metricsRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorMiddleware);
