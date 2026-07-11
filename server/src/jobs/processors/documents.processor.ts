import { documentGeneratorService } from "../../services/documentGenerator.service.js";
import { recordBullMQJob } from "../../observability/collectors.js";
import { jobNames } from "../jobNames.js";
import type { DocumentJob } from "../queues.js";
import type { GeneratorProposal, GeneratorProject } from "../../services/documentGenerator.service.js";

// BullMQ serializes job data as JSON, so Date fields arrive as ISO strings.
// Parse them back before handing the payload to the PDF generators.
function reviveDate(value: unknown): Date | undefined {
  return typeof value === "string" ? new Date(value) : undefined;
}

function reviveProposal(p: GeneratorProposal): GeneratorProposal {
  return { ...p, expiresAt: p.expiresAt ? reviveDate(p.expiresAt) ?? null : null };
}

function reviveProject(p: GeneratorProject): GeneratorProject {
  return { ...p, deadline: p.deadline ? reviveDate(p.deadline) ?? null : null };
}

export async function processDocumentJob(data: DocumentJob): Promise<void> {
  const start = performance.now();
  try {
    switch (data.kind) {
      case "welcomeLetter":
        await documentGeneratorService.generateWelcomeLetter(
          reviveProposal(data.proposal),
          reviveProject(data.project),
          data.client,
          data.manager,
          data.uploadedById
        );
        break;
      case "contract":
        await documentGeneratorService.generateContract(
          reviveProposal(data.proposal),
          reviveProject(data.project),
          data.client,
          data.uploadedById
        );
        break;
      case "specs":
        await documentGeneratorService.generateSpecs(reviveProject(data.project), data.client, data.uploadedById);
        break;
      case "clientBrief":
        await documentGeneratorService.generateClientBrief(reviveProject(data.project), data.client, data.uploadedById);
        break;
      case "quote":
        await documentGeneratorService.generateQuotePDF(
          reviveProposal(data.proposal),
          data.project ? reviveProject(data.project) : null,
          data.client,
          data.uploadedById
        );
        break;
      case "invoice":
        await documentGeneratorService.generateInvoicePDF(
          { ...data.invoice, dueDate: data.invoice.dueDate ? reviveDate(data.invoice.dueDate) ?? null : null },
          reviveProject(data.project),
          data.client,
          data.uploadedById
        );
        break;
      case "roadmap":
        await documentGeneratorService.generateRoadmap(reviveProject(data.project), data.uploadedById);
        break;
    }
    recordBullMQJob("documents", jobNames.generateDocument, "completed", (performance.now() - start) / 1000);
  } catch (error) {
    recordBullMQJob("documents", jobNames.generateDocument, "failed", (performance.now() - start) / 1000);
    throw error; // BullMQ will retry per queue's default job options
  }
}
