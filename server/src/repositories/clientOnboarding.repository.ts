// Client Onboarding Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

function buildOrderBy(orderBy: string | undefined, orderDir: "asc" | "desc") {
  const allowed = ["createdAt", "updatedAt"];
  const field = orderBy && allowed.includes(orderBy) ? orderBy : "createdAt";
  return { [field]: orderDir };
}

function buildWhere(search?: string, companyId?: string, clientId?: string) {
  const where: any = {};

  if (companyId) {
    where.companyId = companyId;
  }

  if (clientId) {
    where.clientId = clientId;
  }

  if (search) {
    where.OR = [
      { project: { name: { contains: search, mode: "insensitive" } } },
      { client: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export const clientOnboardingRepository = {
  async findAll(
    options: ListQueryOptions & { search?: string; companyId?: string; clientId?: string }
  ): Promise<PaginatedResult<any>> {
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir);
    const where = buildWhere(options.search, options.companyId, options.clientId);

    const [data, total] = await Promise.all([
      prismaRead.clientOnboarding.findMany({
        where,
        include: {
          project: true,
          client: true,
          assignedUser: true,
          steps: {
            include: {
              contract: true,
              payment: true,
              questionnaire: true,
              specifications: true,
              kickoff: true,
              production: true,
              delivery: true,
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy,
        skip,
        take: options.pageSize,
      }),
      prismaRead.clientOnboarding.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findById(id: string): Promise<any | null> {
    return prismaRead.clientOnboarding.findUnique({
      where: { id },
      include: {
        project: true,
        client: true,
        assignedUser: true,
        steps: {
          include: {
            contract: true,
            payment: true,
            questionnaire: true,
            specifications: true,
            kickoff: true,
            production: true,
            delivery: true,
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  },

  async findByProjectId(projectId: string): Promise<any | null> {
    return prismaRead.clientOnboarding.findUnique({
      where: { projectId },
      include: {
        project: true,
        client: true,
        assignedUser: true,
        steps: {
          include: {
            contract: true,
            payment: true,
            questionnaire: true,
            specifications: true,
            kickoff: true,
            production: true,
            delivery: true,
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  },

  async create(data: {
    projectId: string;
    clientId: string;
    companyId: string;
    assignedUserId?: string;
    steps?: Array<{
      stepType: string;
      title: string;
      description?: string;
      orderIndex: number;
    }>;
  }): Promise<any> {
    return prisma.clientOnboarding.create({
      data: {
        projectId: data.projectId,
        clientId: data.clientId,
        companyId: data.companyId,
        assignedUserId: data.assignedUserId,
        steps: {
          create: data.steps || [],
        },
      },
      include: {
        project: true,
        client: true,
        steps: true,
      },
    });
  },

  async update(id: string, data: any): Promise<any> {
    return prisma.clientOnboarding.update({
      where: { id },
      data,
      include: {
        project: true,
        client: true,
        steps: true,
      },
    });
  },

  async delete(id: string): Promise<any> {
    return prisma.clientOnboarding.delete({ where: { id } });
  },

  // Step operations
  async addStep(onboardingId: string, data: any): Promise<any> {
    return prisma.onboardingStep.create({
      data: {
        onboardingId,
        ...data,
      },
    });
  },

  async updateStep(stepId: string, data: any): Promise<any> {
    return prisma.onboardingStep.update({
      where: { id: stepId },
      data,
      include: {
        contract: true,
        payment: true,
        questionnaire: true,
        specifications: true,
        kickoff: true,
        production: true,
        delivery: true,
      },
    });
  },

  // Contract operations
  async createContract(stepId: string, data: any): Promise<any> {
    return prisma.contract.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateContract(contractId: string, data: any): Promise<any> {
    return prisma.contract.update({
      where: { id: contractId },
      data,
    });
  },

  // Payment operations
  async createPayment(stepId: string, data: any): Promise<any> {
    return prisma.payment.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updatePayment(paymentId: string, data: any): Promise<any> {
    return prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  },

  // Questionnaire operations
  async createQuestionnaire(stepId: string, data: any): Promise<any> {
    return prisma.questionnaire.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateQuestionnaire(questionnaireId: string, data: any): Promise<any> {
    return prisma.questionnaire.update({
      where: { id: questionnaireId },
      data,
    });
  },

  // Specifications operations
  async createSpecifications(stepId: string, data: any): Promise<any> {
    return prisma.specifications.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateSpecifications(specificationsId: string, data: any): Promise<any> {
    return prisma.specifications.update({
      where: { id: specificationsId },
      data,
    });
  },

  // Kickoff operations
  async createKickoff(stepId: string, data: any): Promise<any> {
    return prisma.kickoffMeeting.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateKickoff(kickoffId: string, data: any): Promise<any> {
    return prisma.kickoffMeeting.update({
      where: { id: kickoffId },
      data,
    });
  },

  // Production operations
  async createProduction(stepId: string, data: any): Promise<any> {
    return prisma.productionProgress.create({
      data: {
        onboardingStepId: stepId,
        analysis: 0,
        design: 0,
        development: 0,
        testing: 0,
        deployment: 0,
        ...data,
      },
    });
  },

  async updateProduction(productionId: string, data: any): Promise<any> {
    return prisma.productionProgress.update({
      where: { id: productionId },
      data,
    });
  },

  // Delivery operations
  async createDelivery(stepId: string, data: any): Promise<any> {
    return prisma.delivery.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateDelivery(deliveryId: string, data: any): Promise<any> {
    return prisma.delivery.update({
      where: { id: deliveryId },
      data,
    });
  },
};
