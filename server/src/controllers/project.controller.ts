// Controller for Projects - HTTP request handlers
import type { RequestHandler } from "express";
import { ProjectStatus } from "@prisma/client";
import { projectService } from "../services/project.service.js";
import { parseListQuery } from "../utils/listQuery.js";
import { HttpError } from "../utils/httpError.js";
import { buildServiceScope } from "../utils/serviceScope.js";
import { regenerateSpecsWithAiContent, regenerateRoadmapWithAiContent } from "../services/projectSpecs.service.js";
import { userRepository } from "../repositories/user.repository.js";

const VALID_PROJECT_STATUSES = new Set(Object.values(ProjectStatus));

// A set of statuses (e.g. the freelancer "active" sub-tab spanning PLANNING/IN_PROGRESS/REVIEW)
// — distinct from parseListQuery's single-value `status`, which every other entity's
// ListQueryOptions also uses. Invalid values are silently dropped rather than 400ing, matching
// the tolerant style of the rest of parseListQuery's own parsing.
function parseStatusIn(raw: unknown): ProjectStatus[] | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const statuses = raw.split(",").map((s) => s.trim()).filter((s): s is ProjectStatus => VALID_PROJECT_STATUSES.has(s as ProjectStatus));
  return statuses.length > 0 ? statuses : undefined;
}

export const getAllProjects: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const clientId = req.user?.clientId as string | undefined;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const statusIn = parseStatusIn(req.query.statusIn);
    const scope = userRole === "MANAGER" ? await buildServiceScope(req) : undefined;
    const result = await projectService.getAllProjects(userId, userRole, options, clientId, scope?.userServiceId, statusIn);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getDeletedProjects: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const clientId = req.user?.clientId as string | undefined;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const scope = userRole === "MANAGER" ? await buildServiceScope(req) : undefined;
    const result = await projectService.getDeletedProjects(userId, userRole, options, clientId, scope?.userServiceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getProjectById: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const clientId = req.user?.clientId as string | undefined;
    const scope = userRole === "MANAGER" ? await buildServiceScope(req) : undefined;
    const project = await projectService.getProjectById(req.params.id as string, userId, userRole, clientId, scope?.userServiceId);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const createProject: RequestHandler = async (req, res, next) => {
  try {
    const scope = req.user?.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const project = await projectService.createProject(req.body, scope);
    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    const scope = req.user?.role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const project = await projectService.updateProject(req.params.id as string, req.body, scope);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    await projectService.deleteProject(req.params.id as string, req.user?.sub, req.user?.role);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const restoreProject: RequestHandler = async (req, res, next) => {
  try {
    const project = await projectService.restoreProject(req.params.id as string, req.user?.sub, req.user?.role);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const archiveProject: RequestHandler = async (req, res, next) => {
  try {
    const project = await projectService.archiveProject(req.params.id as string, req.user?.sub, req.user?.role);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const unarchiveProject: RequestHandler = async (req, res, next) => {
  try {
    const project = await projectService.unarchiveProject(req.params.id as string, req.user?.sub, req.user?.role);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
};

export const getMyProjects: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user!.clientId!;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await projectService.getAllProjects(req.user!.sub, "CLIENT", options, clientId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getBrief: RequestHandler = async (req, res, next) => {
  try {
    const role = req.user!.role;
    const clientId = req.user?.clientId as string | undefined;
    const userId = req.user?.sub;
    const scope = role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const result = await projectService.getBrief(req.params.id as string, role, clientId, userId, scope?.userServiceId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const submitBrief: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) return next(new Error("Client access required"));
    const uploadedById = req.user!.sub;
    const updated = await projectService.submitBrief(
      req.params.id as string,
      clientId,
      uploadedById,
      req.body as Record<string, unknown>
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

// Called back by the n8n brief-to-specs workflow, not by an authenticated Secritou user —
// gated by HMAC signature (verifyN8nWebhook) instead of authenticate/authorize. n8n has no
// notion of "which manager uploaded this", so documents are attributed to the first ADMIN
// found (mirrors other system-generated documents, e.g. proposal-acceptance PDFs).
// Accepts sections (SPECS) and/or roadmap (ROADMAP) — regenerates whichever is present so a
// single n8n callback can update both documents from one brief submission.
export const receiveAiSpecs: RequestHandler = async (req, res, next) => {
  try {
    const { sections, roadmap } = req.body ?? {};
    if (!sections && !roadmap) {
      res.status(400).json({ error: "sections and/or roadmap is required" });
      return;
    }
    const [admin] = await userRepository.findAdmins();
    if (!admin) {
      res.status(409).json({ error: "No ADMIN user found to attribute the generated document to" });
      return;
    }

    const projectId = req.params.id as string;
    const results: Record<string, unknown> = {};
    if (sections && typeof sections === "object") {
      results.specs = await regenerateSpecsWithAiContent(projectId, sections, admin.id);
    }
    if (roadmap && typeof roadmap === "object") {
      results.roadmap = await regenerateRoadmapWithAiContent(projectId, roadmap, admin.id);
    }
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
};

export const clientApproveProject: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) return next(new HttpError(403, "Client access required"));
    const userId = req.user!.sub;
    const result = await projectService.clientApprove(req.params.id as string, clientId, userId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getTimelineStatus: RequestHandler = async (req, res, next) => {
  try {
    const role = req.user!.role;
    const clientId = req.user?.clientId as string | undefined;
    const userId = req.user?.sub;
    const scope = role === "MANAGER" ? await buildServiceScope(req) : undefined;
    const steps = await projectService.getTimelineStatus(
      req.params.id as string,
      role,
      clientId,
      userId,
      scope?.userServiceId
    );
    res.json({ data: steps });
  } catch (error) {
    next(error);
  }
};

// SEC-061: CLIENT-only, mirrors getTimelineStatus's own CLIENT branch (clientId scoping) — a
// dedicated route rather than folding into getTimelineStatus, since this returns real task rows
// (title + completion date) rather than the timeline's synthetic 7-step summary.
export const getCompletedTasks: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.user?.clientId as string | undefined;
    const tasks = await projectService.getCompletedTasksForClient(req.params.id as string, clientId);
    res.json({ data: tasks });
  } catch (error) {
    next(error);
  }
};
