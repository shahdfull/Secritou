import type { JwtPayload } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      // Set by portfolio.routes.ts#getFreelancerId after resolving the caller's FreelancerProfile.
      freelancerId?: string;
    }
  }
}
