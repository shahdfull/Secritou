import { prismaRead } from "../config/prisma.js";
import { documentRepository } from "../repositories/document.repository.js";
import { documentGeneratorService } from "./documentGenerator.service.js";
import { HttpError } from "../utils/httpError.js";
import logger from "../utils/logger.js";

export type AiSpecsSections = Partial<Record<"contexte" | "objectifs" | "besoins" | "fonctionnalites" | "livrables" | "criteres", string>>;
export type AiRoadmapContent = { stepEstimates?: Partial<Record<string, string>>; notes?: string };

async function loadProjectWithClient(projectId: string) {
  const project = await prismaRead.project.findFirst({
    where: { id: projectId },
    select: { id: true, name: true, description: true, budget: true, deadline: true, serviceId: true, clientId: true, client: { select: { id: true, name: true, email: true } } },
  });
  if (!project) throw new HttpError(404, "Project not found");
  if (!project.client) throw new HttpError(409, "Project has no client — cannot generate this document", "PROJECT_NO_CLIENT");
  return project;
}

/**
 * Regenerates a project's SPECS document with AI-written section content (from the
 * brief-to-specs n8n pipeline — see project.service.ts submitBrief and
 * freelancerApplication.routes.ts for the sibling pattern this mirrors). Versions off the
 * existing SPECS document rather than silently overwriting it, so the original (usually the
 * empty placeholder generated at proposal acceptance) stays in the document history.
 */
export async function regenerateSpecsWithAiContent(projectId: string, sections: AiSpecsSections, uploadedById: string) {
  const project = await loadProjectWithClient(projectId);
  const previous = await documentRepository.findLatestByProjectAndType(projectId, "SPECS");

  const docProject = { id: project.id, name: project.name, description: project.description ?? undefined, budget: project.budget ?? undefined, deadline: project.deadline ?? undefined, serviceId: project.serviceId };
  const docClient = { id: project.client!.id, name: project.client!.name, email: project.client!.email ?? undefined };

  const document = await documentGeneratorService.generateSpecs(
    docProject,
    docClient,
    uploadedById,
    sections,
    previous ? { version: previous.version + 1, parentId: previous.id } : undefined
  );

  logger.info({ projectId, documentId: document.id, previousDocumentId: previous?.id }, "[projectSpecs] Regenerated SPECS with AI content");
  return document;
}

/**
 * Same pattern as regenerateSpecsWithAiContent, for the ROADMAP document — per-step
 * estimates and notes instead of fixed blank date fields.
 */
export async function regenerateRoadmapWithAiContent(projectId: string, content: AiRoadmapContent, uploadedById: string) {
  const project = await loadProjectWithClient(projectId);
  const previous = await documentRepository.findLatestByProjectAndType(projectId, "ROADMAP");

  const docProject = { id: project.id, name: project.name, description: project.description ?? undefined, budget: project.budget ?? undefined, deadline: project.deadline ?? undefined, serviceId: project.serviceId };

  const document = await documentGeneratorService.generateRoadmap(
    docProject,
    uploadedById,
    content,
    previous ? { version: previous.version + 1, parentId: previous.id } : undefined
  );

  logger.info({ projectId, documentId: document.id, previousDocumentId: previous?.id }, "[projectSpecs] Regenerated ROADMAP with AI content");
  return document;
}
