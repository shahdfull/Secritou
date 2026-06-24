import { clientOnboardingRepository } from "../repositories/clientOnboarding.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmails } from "../jobs/queues.js";
import { onboardingStepCompletedTemplate } from "./emailTemplates/index.js";
import { prismaRead } from "../config/prisma.js";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const clientOnboardingService = {
  async getAllOnboardings(options: ListQueryOptions & { search?: string; clientId?: string }) {
    return clientOnboardingRepository.findAll(options);
  },

  async getOnboardingById(id: string) {
    return clientOnboardingRepository.findById(id);
  },

  async getOnboardingByProjectId(projectId: string) {
    return clientOnboardingRepository.findByProjectId(projectId);
  },

  async createOnboarding(data: { projectId: string; assignedUserId?: string }) {
    const project = await projectRepository.findByIdAdmin(data.projectId);
    if (!project) throw new Error("Project not found");
    if (!project.clientId) throw new Error("Project has no associated client");

    const client = await clientRepository.findById(project.clientId);
    if (!client) throw new Error("Client not found");

    const defaultSteps = [
      { stepType: "welcome", title: "Projet confirmé", orderIndex: 0 },
      { stepType: "contract", title: "Contrat", orderIndex: 1 },
      { stepType: "payment", title: "Paiement", orderIndex: 2 },
      { stepType: "questionnaire", title: "Questionnaire", orderIndex: 3 },
      { stepType: "specifications", title: "Cahier des charges", orderIndex: 4 },
      { stepType: "kickoff", title: "Réunion de lancement", orderIndex: 5 },
      { stepType: "production", title: "Production", orderIndex: 6 },
      { stepType: "delivery", title: "Livraison", orderIndex: 7 },
    ];

    return clientOnboardingRepository.create({ projectId: data.projectId, clientId: project.clientId!, assignedUserId: data.assignedUserId, steps: defaultSteps });
  },

  async updateOnboarding(id: string, data: any) {
    return clientOnboardingRepository.update(id, data);
  },

  async deleteOnboarding(id: string) {
    return clientOnboardingRepository.delete(id);
  },

  async addStep(onboardingId: string, data: any) {
    return clientOnboardingRepository.addStep(onboardingId, data);
  },

  async updateStep(stepId: string, data: any) {
    const step = await clientOnboardingRepository.updateStep(stepId, data);

    if (data.completedAt || data.status === "COMPLETED") {
      try {
        const stepWithOnboarding = await prismaRead.onboardingStep.findUnique({
          where: { id: stepId },
          select: {
            title: true,
            orderIndex: true,
            onboarding: {
              select: {
                projectId: true,
                project: { select: { name: true } },
                steps: { select: { title: true, orderIndex: true }, orderBy: { orderIndex: "asc" } },
              },
            },
          },
        });

        if (stepWithOnboarding) {
          const { onboarding } = stepWithOnboarding;
          const admins = await userRepository.findAdmins();
          const nextStep = onboarding.steps.find((s) => s.orderIndex > stepWithOnboarding.orderIndex);

          void enqueueEmails(
            admins.map((admin) => {
              const { subject, html } = onboardingStepCompletedTemplate(admin.name ?? "Admin", onboarding.project?.name ?? onboarding.projectId, stepWithOnboarding.title, nextStep?.title);
              return { to: admin.email, subject, html };
            })
          );
        }
      } catch {
        // Non-fatal
      }
    }

    return step;
  },

  async createContract(stepId: string, data: any) { return clientOnboardingRepository.createContract(stepId, data); },
  async updateContract(contractId: string, data: any) { return clientOnboardingRepository.updateContract(contractId, data); },
  async createPayment(stepId: string, data: any) { return clientOnboardingRepository.createPayment(stepId, data); },
  async updatePayment(paymentId: string, data: any) { return clientOnboardingRepository.updatePayment(paymentId, data); },
  async createQuestionnaire(stepId: string, data: any) { return clientOnboardingRepository.createQuestionnaire(stepId, data); },
  async updateQuestionnaire(questionnaireId: string, data: any) { return clientOnboardingRepository.updateQuestionnaire(questionnaireId, data); },
  async createSpecifications(stepId: string, data: any) { return clientOnboardingRepository.createSpecifications(stepId, data); },
  async updateSpecifications(specificationsId: string, data: any) { return clientOnboardingRepository.updateSpecifications(specificationsId, data); },
  async createKickoff(stepId: string, data: any) { return clientOnboardingRepository.createKickoff(stepId, data); },
  async updateKickoff(kickoffId: string, data: any) { return clientOnboardingRepository.updateKickoff(kickoffId, data); },
  async createProduction(stepId: string, data: any) { return clientOnboardingRepository.createProduction(stepId, data); },
  async updateProduction(productionId: string, data: any) { return clientOnboardingRepository.updateProduction(productionId, data); },
  async createDelivery(stepId: string, data: any) { return clientOnboardingRepository.createDelivery(stepId, data); },
  async updateDelivery(deliveryId: string, data: any) { return clientOnboardingRepository.updateDelivery(deliveryId, data); },
};
