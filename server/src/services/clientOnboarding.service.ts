import { clientOnboardingRepository } from "../repositories/clientOnboarding.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const clientOnboardingService = {
  async getAllOnboardings(
    options: ListQueryOptions & { search?: string; companyId?: string; clientId?: string }
  ) {
    return clientOnboardingRepository.findAll(options);
  },

  async getOnboardingById(id: string) {
    return clientOnboardingRepository.findById(id);
  },

  async getOnboardingByProjectId(projectId: string) {
    return clientOnboardingRepository.findByProjectId(projectId);
  },

  async createOnboarding(data: {
    projectId: string;
    companyId: string;
    assignedUserId?: string;
  }) {
    // Validate project exists
    const project = await projectRepository.findById(data.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Validate client exists
    const client = await clientRepository.findById(project.clientId);
    if (!client) {
      throw new Error("Client not found");
    }

    // Create default steps
    const defaultSteps = [
      {
        stepType: "welcome",
        title: "Project Confirmed",
        orderIndex: 0,
      },
      {
        stepType: "contract",
        title: "Contract",
        orderIndex: 1,
      },
      {
        stepType: "payment",
        title: "Payment",
        orderIndex: 2,
      },
      {
        stepType: "questionnaire",
        title: "Questionnaire",
        orderIndex: 3,
      },
      {
        stepType: "specifications",
        title: "Specifications",
        orderIndex: 4,
      },
      {
        stepType: "kickoff",
        title: "Kickoff Meeting",
        orderIndex: 5,
      },
      {
        stepType: "production",
        title: "Production",
        orderIndex: 6,
      },
      {
        stepType: "delivery",
        title: "Delivery",
        orderIndex: 7,
      },
    ];

    return clientOnboardingRepository.create({
      projectId: data.projectId,
      clientId: project.clientId,
      companyId: data.companyId,
      assignedUserId: data.assignedUserId,
      steps: defaultSteps,
    });
  },

  async updateOnboarding(id: string, data: any) {
    return clientOnboardingRepository.update(id, data);
  },

  async deleteOnboarding(id: string) {
    return clientOnboardingRepository.delete(id);
  },

  // Step operations
  async addStep(onboardingId: string, data: any) {
    return clientOnboardingRepository.addStep(onboardingId, data);
  },

  async updateStep(stepId: string, data: any) {
    return clientOnboardingRepository.updateStep(stepId, data);
  },

  // Contract operations
  async createContract(stepId: string, data: any) {
    return clientOnboardingRepository.createContract(stepId, data);
  },

  async updateContract(contractId: string, data: any) {
    return clientOnboardingRepository.updateContract(contractId, data);
  },

  // Payment operations
  async createPayment(stepId: string, data: any) {
    return clientOnboardingRepository.createPayment(stepId, data);
  },

  async updatePayment(paymentId: string, data: any) {
    return clientOnboardingRepository.updatePayment(paymentId, data);
  },

  // Questionnaire operations
  async createQuestionnaire(stepId: string, data: any) {
    return clientOnboardingRepository.createQuestionnaire(stepId, data);
  },

  async updateQuestionnaire(questionnaireId: string, data: any) {
    return clientOnboardingRepository.updateQuestionnaire(questionnaireId, data);
  },

  // Specifications operations
  async createSpecifications(stepId: string, data: any) {
    return clientOnboardingRepository.createSpecifications(stepId, data);
  },

  async updateSpecifications(specificationsId: string, data: any) {
    return clientOnboardingRepository.updateSpecifications(specificationsId, data);
  },

  // Kickoff operations
  async createKickoff(stepId: string, data: any) {
    return clientOnboardingRepository.createKickoff(stepId, data);
  },

  async updateKickoff(kickoffId: string, data: any) {
    return clientOnboardingRepository.updateKickoff(kickoffId, data);
  },

  // Production operations
  async createProduction(stepId: string, data: any) {
    return clientOnboardingRepository.createProduction(stepId, data);
  },

  async updateProduction(productionId: string, data: any) {
    return clientOnboardingRepository.updateProduction(productionId, data);
  },

  // Delivery operations
  async createDelivery(stepId: string, data: any) {
    return clientOnboardingRepository.createDelivery(stepId, data);
  },

  async updateDelivery(deliveryId: string, data: any) {
    return clientOnboardingRepository.updateDelivery(deliveryId, data);
  },
};
