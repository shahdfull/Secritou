import type { JwtPayload } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      // Set by portfolio.routes.ts#getFreelancerId after resolving the caller's FreelancerProfile.
      freelancerId?: string;
      // Set by requestIdMiddleware (logging.middleware.ts): per-request correlation id.
      id?: string;
      // Captured by the express.json verify hook (app.ts) for HMAC signature checks
      // (verifyN8nWebhook.middleware.ts) that need the exact raw payload.
      rawBody?: string;
    }
  }
}
