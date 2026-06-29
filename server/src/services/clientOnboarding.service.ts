import { clientOnboardingRepository } from "../repositories/clientOnboarding.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmails } from "../jobs/queues.js";
import { onboardingStepCompletedTemplate } from "./emailTemplates/index.js";
import { prismaRead } from "../config/prisma.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import type {
  UpdateOnboardingInput,
  UpdateStepInput,
  ContractInput,
  PaymentInput,
  QuestionnaireInput,
  SpecificationsInput,
  KickoffInput,
  ProductionInput,
  DeliveryInput,
} from "../validators/clientOnboarding.validator.js";

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

  async updateOnboarding(id: string, data: UpdateOnboardingInput) {
    return clientOnboardingRepository.update(id, data);
  },

  async deleteOnboarding(id: string) {
    return clientOnboardingRepository.delete(id);
  },

  async addStep(onboardingId: string, data: Parameters<typeof clientOnboardingRepository.addStep>[1]) {
    return clientOnboardingRepository.addStep(onboardingId, data);
  },

  async updateStep(stepId: string, data: UpdateStepInput) {
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

  async createContract(stepId: string, data: ContractInput) { return clientOnboardingRepository.createContract(stepId, data); },
  async updateContract(contractId: string, data: ContractInput) { return clientOnboardingRepository.updateContract(contractId, data); },
  async createPayment(stepId: string, data: PaymentInput) { return clientOnboardingRepository.createPayment(stepId, data); },
  async updatePayment(paymentId: string, data: PaymentInput) { return clientOnboardingRepository.updatePayment(paymentId, data); },
  async createQuestionnaire(stepId: string, data: QuestionnaireInput) { return clientOnboardingRepository.createQuestionnaire(stepId, data); },
  async updateQuestionnaire(questionnaireId: string, data: QuestionnaireInput) { return clientOnboardingRepository.updateQuestionnaire(questionnaireId, data); },
  async createSpecifications(stepId: string, data: SpecificationsInput) { return clientOnboardingRepository.createSpecifications(stepId, data); },
  async updateSpecifications(specificationsId: string, data: SpecificationsInput) { return clientOnboardingRepository.updateSpecifications(specificationsId, data); },
  async createKickoff(stepId: string, data: KickoffInput) { return clientOnboardingRepository.createKickoff(stepId, data); },
  async updateKickoff(kickoffId: string, data: KickoffInput) { return clientOnboardingRepository.updateKickoff(kickoffId, data); },
  async createProduction(stepId: string, data: ProductionInput) { return clientOnboardingRepository.createProduction(stepId, data); },
  async updateProduction(productionId: string, data: ProductionInput) { return clientOnboardingRepository.updateProduction(productionId, data); },
  async createDelivery(stepId: string, data: DeliveryInput) { return clientOnboardingRepository.createDelivery(stepId, data); },
  async updateDelivery(deliveryId: string, data: DeliveryInput) { return clientOnboardingRepository.updateDelivery(deliveryId, data); },
};
