// Service for Projects - SaaS business logic
import { projectRepository } from "../repositories/project.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { tenantValidation } from "./tenantValidation.service.js";
import { enqueueNotifications } from "../jobs/queues.js";
import type { CreateProjectDTO } from "../types/entities.js";
import { HttpError } from "../utils/httpError.js";
import type { Role } from "@prisma/client";
import type { ListQueryOptions } from "../utils/listQuery.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { prismaRead } from "../config/prisma.js";

export type TimelineStepStatus = "done" | "pending" | "locked";

export interface TimelineStep {
  key: string;
  label: string;
  status: TimelineStepStatus;
  date: string | null;
}

export const projectService = {
  async getAllProjects(
    companyId: string,
    userId: string,
    userRole: Role,
    options: ListQueryOptions,
    clientId?: string
  ) {
    return projectRepository.findAll(companyId, userId, userRole, options, clientId);
  },

  async getProjectById(id: string, companyId: string, userId: string, userRole: Role, clientId?: string) {
    const project = await projectRepository.findById(id, companyId, userId, userRole, clientId);
    if (!project) throw new HttpError(404, "Project not found");
    return project;
  },

  async createProject(data: CreateProjectDTO, companyId: string) {
    if (data.clientId) {
      await tenantValidation.assertClientInCompany(data.clientId, companyId);
    }
    const project = await projectRepository.create({ ...data, companyId });
    const tagsToInvalidate = [cacheTags.company(companyId), cacheTags.dashboard(companyId)];
    if (data.clientId) tagsToInvalidate.push(cacheTags.client(companyId, data.clientId));
    await invalidateTags(tagsToInvalidate);
    return project;
  },

  async updateProject(id: string, data: Partial<CreateProjectDTO>, companyId: string) {
    const project = await projectRepository.findByIdAdmin(id, companyId);
    if (!project) throw new HttpError(404, "Project not found");
    if (data.clientId) {
      await tenantValidation.assertClientInCompany(data.clientId, companyId);
    }

    const updated = await projectRepository.update(id, companyId, data);

    if (data.status && data.status !== project.status && project.clientId) {
      const clientUsers = await userRepository.findByClientId(project.clientId);
      await enqueueNotifications(
        clientUsers.map((user) => ({
          userId: user.id,
          title: "Mise à jour du projet",
          message: `Le projet "${project.name}" est passé à ${data.status}`,
        })),
      );
    }

    const tagsToInvalidate = [
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.project(companyId, id),
    ];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(companyId, project.clientId));
    await invalidateTags(tagsToInvalidate);
    return updated;
  },

  async deleteProject(id: string, companyId: string) {
    const project = await projectRepository.findByIdAdmin(id, companyId);
    if (!project) throw new HttpError(404, "Project not found");

    // A project tied to issued invoices (anything past DRAFT) is part of the financial record
    // and must not be hard-deleted — archive it instead.
    const nonDraftInvoices = await projectRepository.countNonDraftInvoices(id, companyId);
    if (nonDraftInvoices > 0) {
      throw new HttpError(
        409,
        "Project has issued invoices and cannot be deleted; archive it instead",
        "PROJECT_HAS_INVOICES"
      );
    }

    // An onboarding now restricts deletion at the DB level (onDelete: Restrict). Surface that
    // as a clean business error rather than letting the FK constraint throw a raw 500.
    const onboardings = await projectRepository.countOnboardings(id, companyId);
    if (onboardings > 0) {
      throw new HttpError(
        409,
        "Project has an onboarding record and cannot be deleted; archive it instead",
        "PROJECT_HAS_ONBOARDING"
      );
    }

    const deleted = await projectRepository.delete(id, companyId);
    const tagsToInvalidate = [
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.project(companyId, id),
    ];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(companyId, project.clientId));
    await invalidateTags(tagsToInvalidate);
    return deleted;
  },

  async archiveProject(id: string, companyId: string) {
    const project = await projectRepository.findByIdAdmin(id, companyId);
    if (!project) throw new HttpError(404, "Project not found");
    const archived = await projectRepository.archive(id, companyId);
    const tagsToInvalidate = [
      cacheTags.company(companyId),
      cacheTags.dashboard(companyId),
      cacheTags.project(companyId, id),
    ];
    if (project.clientId) tagsToInvalidate.push(cacheTags.client(companyId, project.clientId));
    await invalidateTags(tagsToInvalidate);
    return archived;
  },

  // Derives the 7-step project timeline from existing project + document + task state.
  // No new DB columns — each step's "done" condition is computed from what already exists.
  // briefCompleted: proxied via CLIENT_BRIEF document existence (auto-generated at acceptance).
  // PENDING_CLIENT_APPROVAL maps to REVIEW status (closest in the existing enum).
  async getTimelineStatus(
    id: string,
    companyId: string,
    role: Role,
    clientId?: string
  ): Promise<TimelineStep[]> {
    // Scope check: CLIENT may only see their own project
    const project = await prismaRead.project.findFirst({
      where: {
        id,
        companyId,
        ...(role === "CLIENT" ? { clientId: clientId ?? "__none__" } : {}),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        tasks: { select: { status: true, updatedAt: true } },
      },
    });
    if (!project) throw new HttpError(404, "Project not found");

    const docs = await prismaRead.document.findMany({
      where: { projectId: id, companyId },
      select: { type: true, signedAt: true, createdAt: true },
    });

    const docByType = new Map(docs.map((d) => [d.type, d]));
    const contractDoc = docByType.get("CONTRACT");
    const quoteDoc = docByType.get("QUOTE");
    const briefDoc = docByType.get("CLIENT_BRIEF");

    const inProgressTask = project.tasks.find((t) => t.status === "IN_PROGRESS");
    const fmt = (d: Date | null | undefined) =>
      d ? new Date(d).toISOString().split("T")[0] : null;

    // Each step: compute done, then assign status sequentially (first non-done = pending, rest = locked)
    const conditions: Array<{ key: string; label: string; done: boolean; date: Date | null | undefined }> = [
      {
        key: "confirmed",
        label: "Projet confirmé",
        done: true, // always done once this endpoint is reachable (project exists)
        date: project.createdAt,
      },
      {
        key: "contract",
        label: "Contrat signé",
        done: !!contractDoc?.signedAt,
        date: contractDoc?.signedAt,
      },
      {
        key: "quote",
        label: "Devis validé",
        done: !!quoteDoc,
        date: quoteDoc?.createdAt,
      },
      {
        key: "brief",
        label: "Informations collectées",
        done: !!briefDoc,
        date: briefDoc?.createdAt,
      },
      {
        key: "production",
        label: "Production en cours",
        done: project.status === "IN_PROGRESS" || project.status === "REVIEW" || project.status === "COMPLETED",
        date: inProgressTask?.updatedAt ?? null,
      },
      {
        key: "delivery",
        label: "Livraison",
        done: project.status === "REVIEW" || project.status === "COMPLETED",
        date: null,
      },
      {
        key: "support",
        label: "Support / Suivi",
        done: project.status === "COMPLETED",
        date: null,
      },
    ];

    let foundPending = false;
    return conditions.map(({ key, label, done, date }) => {
      let status: TimelineStepStatus;
      if (done) {
        status = "done";
      } else if (!foundPending) {
        status = "pending";
        foundPending = true;
      } else {
        status = "locked";
      }
      return { key, label, status, date: done ? fmt(date) : null };
    });
  },
};
