import { clientOnboardingRepository } from "../repositories/clientOnboarding.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { tenantValidation } from "./tenantValidation.service.js";
import type { ListQueryOptions } from "../utils/listQuery.js";

export const clientOnboardingService = {
  async getAllOnboardings(
    options: ListQueryOptions & { search?: string; companyId?: string; clientId?: string }
  ) {
    return clientOnboardingRepository.findAll(options);
  },

  async getOnboardingById(id: string, companyId: string) {
    return clientOnboardingRepository.findById(id, companyId);
  },

  async getOnboardingByProjectId(projectId: string, companyId: string) {
    return clientOnboardingRepository.findByProjectId(projectId, companyId);
  },

  async createOnboarding(data: {
    projectId: string;
    companyId: string;
    assignedUserId?: string;
  }) {
    // Validate project exists in company
    const project = await projectRepository.findById(data.projectId, data.companyId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Validate client exists in company
    const client = await clientRepository.findById(project.clientId, data.companyId);
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

  async updateOnboarding(id: string, companyId: string, data: any) {
    return clientOnboardingRepository.update(id, companyId, data);
  },

  async deleteOnboarding(id: string, companyId: string) {
    return clientOnboardingRepository.delete(id, companyId);
  },

  // Step operations
  async addStep(onboardingId: string, companyId: string, data: any) {
    return clientOnboardingRepository.addStep(onboardingId, companyId, data);
  },

  async updateStep(stepId: string, companyId: string, data: any) {
    return clientOnboardingRepository.updateStep(stepId, companyId, data);
  },

  // Contract operations
  async createContract(stepId: string, companyId: string, data: any) {
    return clientOnboardingRepository.createContract(stepId, companyId, data);
  },

  async updateContract(contractId: string, companyId: string, data: any) {
    return clientOnboardingRepository.updateContract(contractId, companyId, data);
  },

  // Payment operations
  async createPayment(stepId: string, companyId: string, data: any) {
    return clientOnboardingRepository.createPayment(stepId, companyId, data);
  },

  async updatePayment(paymentId: string, companyId: string, data: any) {
    return clientOnboardingRepository.updatePayment(paymentId, companyId, data);
  },

  // Questionnaire operations
  async createQuestionnaire(stepId: string, companyId: string, data: any) {
    return clientOnboardingRepository.createQuestionnaire(stepId, companyId, data);
  },

  async updateQuestionnaire(questionnaireId: string, companyId: string, data: any) {
    return clientOnboardingRepository.updateQuestionnaire(questionnaireId, companyId, data);
  },

  // Specifications operations
  async createSpecifications(stepId: string, companyId: string, data: any) {
    return clientOnboardingRepository.createSpecifications(stepId, companyId, data);
  },

  async updateSpecifications(specificationsId: string, companyId: string, data: any) {
    return clientOnboardingRepository.updateSpecifications(specificationsId, companyId, data);
  },

  // Kickoff operations
  async createKickoff(stepId: string, companyId: string, data: any) {
    return clientOnboardingRepository.createKickoff(stepId, companyId, data);
  },

  async updateKickoff(kickoffId: string, companyId: string, data: any) {
    return clientOnboardingRepository.updateKickoff(kickoffId, companyId, data);
  },

  // Production operations
  async createProduction(stepId: string, companyId: string, data: any) {
    return clientOnboardingRepository.createProduction(stepId, companyId, data);
  },

  async updateProduction(productionId: string, companyId: string, data: any) {
    return clientOnboardingRepository.updateProduction(productionId, companyId, data);
  },

  // Delivery operations
  async createDelivery(stepId: string, companyId: string, data: any) {
    return clientOnboardingRepository.createDelivery(stepId, companyId, data);
  },

  async updateDelivery(deliveryId: string, companyId: string, data: any) {
    return clientOnboardingRepository.updateDelivery(deliveryId, companyId, data);
  },
};
