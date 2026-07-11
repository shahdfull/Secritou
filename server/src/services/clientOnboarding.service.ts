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
  async getAllOnboardings(options: ListQueryOptions & { search?: string; clientId?: string }, userClientId?: string | null) {
    return clientOnboardingRepository.findAll(options, userClientId);
  },

  async getOnboardingById(id: string, userClientId?: string | null) {
    return clientOnboardingRepository.findById(id, userClientId);
  },

  async getOnboardingByProjectId(projectId: string, userClientId?: string | null) {
    return clientOnboardingRepository.findByProjectId(projectId, userClientId);
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

  async updateOnboarding(id: string, data: UpdateOnboardingInput, userClientId?: string | null) {
    return clientOnboardingRepository.update(id, data, userClientId);
  },

  async deleteOnboarding(id: string, userClientId?: string | null) {
    return clientOnboardingRepository.delete(id, userClientId);
  },

  async addStep(onboardingId: string, data: Parameters<typeof clientOnboardingRepository.addStep>[1], userClientId?: string | null) {
    return clientOnboardingRepository.addStep(onboardingId, data, userClientId);
  },

  async updateStep(stepId: string, data: UpdateStepInput, userClientId?: string | null) {
    const step = await clientOnboardingRepository.updateStep(stepId, data, userClientId);

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

  async createContract(stepId: string, data: ContractInput, userClientId?: string | null) { return clientOnboardingRepository.createContract(stepId, data, userClientId); },
  async updateContract(contractId: string, data: ContractInput, userClientId?: string | null) { return clientOnboardingRepository.updateContract(contractId, data, userClientId); },
  async createPayment(stepId: string, data: PaymentInput, userClientId?: string | null) { return clientOnboardingRepository.createPayment(stepId, data, userClientId); },
  async updatePayment(paymentId: string, data: PaymentInput, userClientId?: string | null) { return clientOnboardingRepository.updatePayment(paymentId, data, userClientId); },
  async createQuestionnaire(stepId: string, data: QuestionnaireInput, userClientId?: string | null) { return clientOnboardingRepository.createQuestionnaire(stepId, data, userClientId); },
  async updateQuestionnaire(questionnaireId: string, data: QuestionnaireInput, userClientId?: string | null) { return clientOnboardingRepository.updateQuestionnaire(questionnaireId, data, userClientId); },
  async createSpecifications(stepId: string, data: SpecificationsInput, userClientId?: string | null) { return clientOnboardingRepository.createSpecifications(stepId, data, userClientId); },
  async updateSpecifications(specificationsId: string, data: SpecificationsInput, userClientId?: string | null) { return clientOnboardingRepository.updateSpecifications(specificationsId, data, userClientId); },
  async createKickoff(stepId: string, data: KickoffInput, userClientId?: string | null) { return clientOnboardingRepository.createKickoff(stepId, data, userClientId); },
  async updateKickoff(kickoffId: string, data: KickoffInput, userClientId?: string | null) { return clientOnboardingRepository.updateKickoff(kickoffId, data, userClientId); },
  async createProduction(stepId: string, data: ProductionInput, userClientId?: string | null) { return clientOnboardingRepository.createProduction(stepId, data, userClientId); },
  async updateProduction(productionId: string, data: ProductionInput, userClientId?: string | null) { return clientOnboardingRepository.updateProduction(productionId, data, userClientId); },
  async createDelivery(stepId: string, data: DeliveryInput, userClientId?: string | null) { return clientOnboardingRepository.createDelivery(stepId, data, userClientId); },
  async updateDelivery(deliveryId: string, data: DeliveryInput, userClientId?: string | null) { return clientOnboardingRepository.updateDelivery(deliveryId, data, userClientId); },
};
