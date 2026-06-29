// Client Onboarding Repository - Data access layer
import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import type {
  ClientOnboarding,
  Client,
  Project,
  OnboardingStep,
  Contract,
  Payment,
  Questionnaire,
  Specifications,
  KickoffMeeting,
  ProductionProgress,
  Delivery,
} from "@prisma/client";
import type { ListQueryOptions, PaginatedResult } from "../utils/listQuery.js";

const fullOnboardingInclude = {
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
    orderBy: { orderIndex: "asc" as const },
  },
} satisfies Prisma.ClientOnboardingInclude;

type FullOnboarding = Prisma.ClientOnboardingGetPayload<{ include: typeof fullOnboardingInclude }>;

function buildOrderBy(orderBy: string | undefined, orderDir: "asc" | "desc") {
  const allowed = ["createdAt", "updatedAt"];
  const field = orderBy && allowed.includes(orderBy) ? orderBy : "createdAt";
  return { [field]: orderDir };
}

function buildWhere(search?: string, clientId?: string): Prisma.ClientOnboardingWhereInput {
  const where: Prisma.ClientOnboardingWhereInput = {};
  if (clientId) where.clientId = clientId;
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
    options: ListQueryOptions & { search?: string; clientId?: string }
  ): Promise<PaginatedResult<ClientOnboarding & { client: Pick<Client, "id" | "name">; project: Pick<Project, "id" | "name"> | null }>> {
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir);
    const where = buildWhere(options.search, options.clientId);

    const [data, total] = await Promise.all([
      prismaRead.clientOnboarding.findMany({
        where,
        include: {
          project: true,
          client: true,
          assignedUser: true,
          steps: {
            include: { contract: true, payment: true, questionnaire: true, specifications: true, kickoff: true, production: true, delivery: true },
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

  async findById(id: string): Promise<FullOnboarding | null> {
    return prismaRead.clientOnboarding.findUnique({ where: { id }, include: fullOnboardingInclude });
  },

  async findByProjectId(projectId: string): Promise<FullOnboarding | null> {
    return prismaRead.clientOnboarding.findUnique({ where: { projectId }, include: fullOnboardingInclude });
  },

  async create(data: {
    projectId: string;
    clientId: string;
    assignedUserId?: string;
    steps?: Array<{ stepType: string; title: string; description?: string; orderIndex: number }>;
  }): Promise<FullOnboarding> {
    return prisma.clientOnboarding.create({
      data: {
        projectId: data.projectId,
        clientId: data.clientId,
        assignedUserId: data.assignedUserId,
        steps: { create: data.steps || [] },
      },
      include: fullOnboardingInclude,
    });
  },

  async update(id: string, data: { assignedUserId?: string }): Promise<FullOnboarding> {
    return prisma.clientOnboarding.update({ where: { id }, data, include: fullOnboardingInclude });
  },

  async delete(id: string): Promise<ClientOnboarding> {
    return prisma.clientOnboarding.delete({ where: { id } });
  },

  async addStep(onboardingId: string, data: Omit<Prisma.OnboardingStepCreateInput, "onboarding">): Promise<OnboardingStep> {
    await prisma.clientOnboarding.findUniqueOrThrow({ where: { id: onboardingId }, select: { id: true } });
    return prisma.onboardingStep.create({ data: { onboarding: { connect: { id: onboardingId } }, ...data } });
  },

  async updateStep(stepId: string, data: Prisma.OnboardingStepUpdateInput): Promise<OnboardingStep> {
    return prisma.onboardingStep.update({
      where: { id: stepId },
      data,
      include: { contract: true, payment: true, questionnaire: true, specifications: true, kickoff: true, production: true, delivery: true },
    });
  },

  async createContract(stepId: string, data: Omit<Prisma.ContractCreateInput, "onboardingStep">): Promise<Contract> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId }, select: { id: true } });
    return prisma.contract.create({ data: { onboardingStep: { connect: { id: stepId } }, ...data } });
  },

  async updateContract(contractId: string, data: Prisma.ContractUpdateInput): Promise<Contract> {
    return prisma.contract.update({ where: { id: contractId }, data });
  },

  async createPayment(stepId: string, data: Omit<Prisma.PaymentCreateInput, "onboardingStep">): Promise<Payment> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId }, select: { id: true } });
    return prisma.payment.create({ data: { onboardingStep: { connect: { id: stepId } }, ...data } });
  },

  async updatePayment(paymentId: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return prisma.payment.update({ where: { id: paymentId }, data });
  },

  async createQuestionnaire(
    stepId: string,
    data: { serviceType?: string; data?: unknown; isDraft?: boolean }
  ): Promise<Questionnaire> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId }, select: { id: true } });
    // serviceType is required at the DB level; cast keeps the original behaviour
    // (Prisma rejects at runtime if it is genuinely missing) instead of masking it.
    const createData = {
      onboardingStep: { connect: { id: stepId } },
      serviceType: data.serviceType,
      isDraft: data.isDraft,
    } as Prisma.QuestionnaireCreateInput;
    if (data.data !== undefined) createData.data = data.data as Prisma.InputJsonValue;
    return prisma.questionnaire.create({ data: createData });
  },

  async updateQuestionnaire(
    questionnaireId: string,
    data: { serviceType?: string; data?: unknown; isDraft?: boolean }
  ): Promise<Questionnaire> {
    const updateData: Prisma.QuestionnaireUpdateInput = {
      serviceType: data.serviceType,
      isDraft: data.isDraft,
    };
    if (data.data !== undefined) updateData.data = data.data as Prisma.InputJsonValue;
    return prisma.questionnaire.update({ where: { id: questionnaireId }, data: updateData });
  },

  async createSpecifications(stepId: string, data: Omit<Prisma.SpecificationsCreateInput, "onboardingStep">): Promise<Specifications> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId }, select: { id: true } });
    return prisma.specifications.create({ data: { onboardingStep: { connect: { id: stepId } }, ...data } });
  },

  async updateSpecifications(specificationsId: string, data: Prisma.SpecificationsUpdateInput): Promise<Specifications> {
    return prisma.specifications.update({ where: { id: specificationsId }, data });
  },

  async createKickoff(stepId: string, data: Omit<Prisma.KickoffMeetingCreateInput, "onboardingStep">): Promise<KickoffMeeting> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId }, select: { id: true } });
    return prisma.kickoffMeeting.create({ data: { onboardingStep: { connect: { id: stepId } }, ...data } });
  },

  async updateKickoff(kickoffId: string, data: Prisma.KickoffMeetingUpdateInput): Promise<KickoffMeeting> {
    return prisma.kickoffMeeting.update({ where: { id: kickoffId }, data });
  },

  async createProduction(stepId: string, data: Omit<Prisma.ProductionProgressCreateInput, "onboardingStep">): Promise<ProductionProgress> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId }, select: { id: true } });
    return prisma.productionProgress.create({ data: { onboardingStep: { connect: { id: stepId } }, analysis: 0, design: 0, development: 0, testing: 0, deployment: 0, ...data } });
  },

  async updateProduction(productionId: string, data: Prisma.ProductionProgressUpdateInput): Promise<ProductionProgress> {
    return prisma.productionProgress.update({ where: { id: productionId }, data });
  },

  async createDelivery(stepId: string, data: Omit<Prisma.DeliveryCreateInput, "onboardingStep">): Promise<Delivery> {
    await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId }, select: { id: true } });
    return prisma.delivery.create({ data: { onboardingStep: { connect: { id: stepId } }, ...data } });
  },

  async updateDelivery(deliveryId: string, data: Prisma.DeliveryUpdateInput): Promise<Delivery> {
    return prisma.delivery.update({ where: { id: deliveryId }, data });
  },
};
