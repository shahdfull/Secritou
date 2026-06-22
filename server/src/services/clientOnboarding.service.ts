import { clientOnboardingRepository } from "../repositories/clientOnboarding.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { COMPANY_ID } from "../config/constants.js";
import { enqueueEmails } from "../jobs/queues.js";
import { onboardingStepCompletedTemplate } from "./emailTemplates/index.js";
import { prismaRead } from "../config/prisma.js";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const clientOnboardingService = {
  async getAllOnboardings(
    options: ListQueryOptions & { search?: string; clientId?: string }
  ) {
    return clientOnboardingRepository.findAll(options);
  },

  async getOnboardingById(id: string) {
    return clientOnboardingRepository.findById(id, COMPANY_ID);
  },

  async getOnboardingByProjectId(projectId: string) {
    return clientOnboardingRepository.findByProjectId(projectId, COMPANY_ID);
  },

  async createOnboarding(data: {
    projectId: string;
    assignedUserId?: string;
  }) {
    // Validate project exists in company
    const project = await projectRepository.findByIdAdmin(data.projectId, COMPANY_ID);
    if (!project) {
      throw new Error("Project not found");
    }
    if (!project.clientId) {
      throw new Error("Project has no associated client");
    }

    // Validate client exists in company
    const client = await clientRepository.findById(project.clientId, COMPANY_ID);
    if (!client) {
      throw new Error("Client not found");
    }

    // Create default steps
    const defaultSteps = [
      {
        stepType: "welcome",
        title: "Projet confirmé",
        orderIndex: 0,
      },
      {
        stepType: "contract",
        title: "Contrat",
        orderIndex: 1,
      },
      {
        stepType: "payment",
        title: "Paiement",
        orderIndex: 2,
      },
      {
        stepType: "questionnaire",
        title: "Questionnaire",
        orderIndex: 3,
      },
      {
        stepType: "specifications",
        title: "Cahier des charges",
        orderIndex: 4,
      },
      {
        stepType: "kickoff",
        title: "Réunion de lancement",
        orderIndex: 5,
      },
      {
        stepType: "production",
        title: "Production",
        orderIndex: 6,
      },
      {
        stepType: "delivery",
        title: "Livraison",
        orderIndex: 7,
      },
    ];

    return clientOnboardingRepository.create({
      projectId: data.projectId,
      clientId: project.clientId!,
      companyId: COMPANY_ID,
      assignedUserId: data.assignedUserId,
      steps: defaultSteps,
    });
  },

  async updateOnboarding(id: string, data: any) {
    return clientOnboardingRepository.update(id, COMPANY_ID, data);
  },

  async deleteOnboarding(id: string) {
    return clientOnboardingRepository.delete(id, COMPANY_ID);
  },

  // Step operations
  async addStep(onboardingId: string, data: any) {
    return clientOnboardingRepository.addStep(onboardingId, COMPANY_ID, data);
  },

  async updateStep(stepId: string, data: any) {
    const step = await clientOnboardingRepository.updateStep(stepId, COMPANY_ID, data);

    // Fire email to admins when a step is marked completed
    if (data.completedAt || data.status === "COMPLETED") {
      try {
        // Resolve step → onboarding → project in one query
        const stepWithOnboarding = await prismaRead.onboardingStep.findUnique({
          where: { id: stepId },
          select: {
            title: true,
            orderIndex: true,
            onboarding: {
              select: {
                projectId: true,
                companyId: true,
                project: { select: { name: true } },
                steps: { select: { title: true, orderIndex: true }, orderBy: { orderIndex: "asc" } },
              },
            },
          },
        });

        if (stepWithOnboarding?.onboarding.companyId === COMPANY_ID) {
          const { onboarding } = stepWithOnboarding;
          const admins = await userRepository.findAdminsByCompanyId(COMPANY_ID);
          const nextStep = onboarding.steps.find(
            (s) => s.orderIndex > stepWithOnboarding.orderIndex
          );

          void enqueueEmails(
            admins.map((admin) => {
              const { subject, html } = onboardingStepCompletedTemplate(
                admin.name ?? "Admin",
                onboarding.project?.name ?? onboarding.projectId,
                stepWithOnboarding.title,
                nextStep?.title
              );
              return { to: admin.email, subject, html };
            })
          );
        }
      } catch {
        // Non-fatal: email failure must not block step update
      }
    }

    return step;
  },

  // Contract operations
  async createContract(stepId: string, data: any) {
    return clientOnboardingRepository.createContract(stepId, COMPANY_ID, data);
  },

  async updateContract(contractId: string, data: any) {
    return clientOnboardingRepository.updateContract(contractId, COMPANY_ID, data);
  },

  // Payment operations
  async createPayment(stepId: string, data: any) {
    return clientOnboardingRepository.createPayment(stepId, COMPANY_ID, data);
  },

  async updatePayment(paymentId: string, data: any) {
    return clientOnboardingRepository.updatePayment(paymentId, COMPANY_ID, data);
  },

  // Questionnaire operations
  async createQuestionnaire(stepId: string, data: any) {
    return clientOnboardingRepository.createQuestionnaire(stepId, COMPANY_ID, data);
  },

  async updateQuestionnaire(questionnaireId: string, data: any) {
    return clientOnboardingRepository.updateQuestionnaire(questionnaireId, COMPANY_ID, data);
  },

  // Specifications operations
  async createSpecifications(stepId: string, data: any) {
    return clientOnboardingRepository.createSpecifications(stepId, COMPANY_ID, data);
  },

  async updateSpecifications(specificationsId: string, data: any) {
    return clientOnboardingRepository.updateSpecifications(specificationsId, COMPANY_ID, data);
  },

  // Kickoff operations
  async createKickoff(stepId: string, data: any) {
    return clientOnboardingRepository.createKickoff(stepId, COMPANY_ID, data);
  },

  async updateKickoff(kickoffId: string, data: any) {
    return clientOnboardingRepository.updateKickoff(kickoffId, COMPANY_ID, data);
  },

  // Production operations
  async createProduction(stepId: string, data: any) {
    return clientOnboardingRepository.createProduction(stepId, COMPANY_ID, data);
  },

  async updateProduction(productionId: string, data: any) {
    return clientOnboardingRepository.updateProduction(productionId, COMPANY_ID, data);
  },

  // Delivery operations
  async createDelivery(stepId: string, data: any) {
    return clientOnboardingRepository.createDelivery(stepId, COMPANY_ID, data);
  },

  async updateDelivery(deliveryId: string, data: any) {
    return clientOnboardingRepository.updateDelivery(deliveryId, COMPANY_ID, data);
  },
};
