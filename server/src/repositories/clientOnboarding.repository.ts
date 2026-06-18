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

  async findById(id: string, companyId: string): Promise<any | null> {
    return prismaRead.clientOnboarding.findUnique({
      where: { id, companyId },
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

  async findByProjectId(projectId: string, companyId: string): Promise<any | null> {
    return prismaRead.clientOnboarding.findUnique({
      where: { projectId, project: { companyId } },
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

  async update(id: string, companyId: string, data: any): Promise<any> {
    return prisma.clientOnboarding.update({
      where: { id, companyId },
      data,
      include: {
        project: true,
        client: true,
        steps: true,
      },
    });
  },

  async delete(id: string, companyId: string): Promise<any> {
    return prisma.clientOnboarding.delete({ where: { id, companyId } });
  },

  // Step operations
  async addStep(onboardingId: string, companyId: string, data: any): Promise<any> {
    await prisma.clientOnboarding.findUniqueOrThrow({ where: { id: onboardingId, companyId }, select: { id: true } });
    return prisma.onboardingStep.create({
      data: {
        onboardingId,
        ...data,
      },
    });
  },

  async updateStep(stepId: string, companyId: string, data: any): Promise<any> {
    return prisma.onboardingStep.update({
      where: {
        id: stepId,
        onboarding: { companyId }
      },
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
  async createContract(stepId: string, companyId: string, data: any): Promise<any> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId, onboarding: { companyId } }, select: { id: true } });
    return prisma.contract.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateContract(contractId: string, companyId: string, data: any): Promise<any> {
    return prisma.contract.update({
      where: {
        id: contractId,
        onboardingStep: { onboarding: { companyId } }
      },
      data,
    });
  },

  // Payment operations
  async createPayment(stepId: string, companyId: string, data: any): Promise<any> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId, onboarding: { companyId } }, select: { id: true } });
    return prisma.payment.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updatePayment(paymentId: string, companyId: string, data: any): Promise<any> {
    return prisma.payment.update({
      where: {
        id: paymentId,
        onboardingStep: { onboarding: { companyId } }
      },
      data,
    });
  },

  // Questionnaire operations
  async createQuestionnaire(stepId: string, companyId: string, data: any): Promise<any> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId, onboarding: { companyId } }, select: { id: true } });
    return prisma.questionnaire.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateQuestionnaire(questionnaireId: string, companyId: string, data: any): Promise<any> {
    return prisma.questionnaire.update({
      where: {
        id: questionnaireId,
        onboardingStep: { onboarding: { companyId } }
      },
      data,
    });
  },

  // Specifications operations
  async createSpecifications(stepId: string, companyId: string, data: any): Promise<any> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId, onboarding: { companyId } }, select: { id: true } });
    return prisma.specifications.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateSpecifications(specificationsId: string, companyId: string, data: any): Promise<any> {
    return prisma.specifications.update({
      where: {
        id: specificationsId,
        onboardingStep: { onboarding: { companyId } }
      },
      data,
    });
  },

  // Kickoff operations
  async createKickoff(stepId: string, companyId: string, data: any): Promise<any> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId, onboarding: { companyId } }, select: { id: true } });
    return prisma.kickoffMeeting.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateKickoff(kickoffId: string, companyId: string, data: any): Promise<any> {
    return prisma.kickoffMeeting.update({
      where: {
        id: kickoffId,
        onboardingStep: { onboarding: { companyId } }
      },
      data,
    });
  },

  // Production operations
  async createProduction(stepId: string, companyId: string, data: any): Promise<any> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId, onboarding: { companyId } }, select: { id: true } });
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

  async updateProduction(productionId: string, companyId: string, data: any): Promise<any> {
    return prisma.productionProgress.update({
      where: {
        id: productionId,
        onboardingStep: { onboarding: { companyId } }
      },
      data,
    });
  },

  // Delivery operations
  async createDelivery(stepId: string, companyId: string, data: any): Promise<any> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId, onboarding: { companyId } }, select: { id: true } });
    return prisma.delivery.create({
      data: {
        onboardingStepId: stepId,
        ...data,
      },
    });
  },

  async updateDelivery(deliveryId: string, companyId: string, data: any): Promise<any> {
    return prisma.delivery.update({
      where: {
        id: deliveryId,
        onboardingStep: { onboarding: { companyId } }
      },
      data,
    });
  },
};
