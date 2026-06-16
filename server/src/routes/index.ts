import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { contactRoutes } from "./contact.routes.js";
import clientRoutes from "./client.routes.js";
import leadRoutes from "./lead.routes.js";
import projectRoutes from "./project.routes.js";
import taskRoutes from "./task.routes.js";
import companyRoutes from "./company.routes.js";
import freelancerRoutes from "./freelancer.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import serviceRequestRoutes from "./serviceRequest.routes.js";

export const apiRoutes = Router();

// Health check
apiRoutes.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));

// Public routes
apiRoutes.use("/contact", contactRoutes);
apiRoutes.use("/auth", authRoutes);

// Protected MVP routes
apiRoutes.use("/companies", companyRoutes);
apiRoutes.use("/projects", projectRoutes);
apiRoutes.use("/tasks", taskRoutes);
apiRoutes.use("/clients", clientRoutes);
apiRoutes.use("/leads", leadRoutes);

// Freelancer & Mission routes
apiRoutes.use("/freelancers", freelancerRoutes);

// Analytics routes
apiRoutes.use("/analytics", analyticsRoutes);

// Service Request routes
apiRoutes.use("/service-requests", serviceRequestRoutes);
