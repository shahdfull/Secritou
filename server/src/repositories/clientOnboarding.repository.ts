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

function buildWhere(search?: string, clientId?: string, userClientId?: string | null): Prisma.ClientOnboardingWhereInput {
  const where: Prisma.ClientOnboardingWhereInput = {};
  if (clientId) where.clientId = clientId;
  if (userClientId) where.clientId = userClientId;
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
    options: ListQueryOptions & { search?: string; clientId?: string },
    userClientId?: string | null
  ): Promise<PaginatedResult<ClientOnboarding & { client: Pick<Client, "id" | "name">; project: Pick<Project, "id" | "name"> | null }>> {
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir);
    const where = buildWhere(options.search, options.clientId, userClientId);

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

  async findById(id: string, userClientId?: string | null): Promise<FullOnboarding | null> {
    const where: Prisma.ClientOnboardingWhereUniqueInput = { id };
    if (userClientId) {
      // For userClientId, use first instead of unique since we're adding a clientId filter
      return prismaRead.clientOnboarding.findFirst({ where: { id, clientId: userClientId }, include: fullOnboardingInclude });
    }
    return prismaRead.clientOnboarding.findUnique({ where, include: fullOnboardingInclude });
  },

  async findByProjectId(projectId: string, userClientId?: string | null): Promise<FullOnboarding | null> {
    const where: Prisma.ClientOnboardingWhereInput = { projectId };
    if (userClientId) where.clientId = userClientId;
    return prismaRead.clientOnboarding.findFirst({ where, include: fullOnboardingInclude });
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

  async update(id: string, data: { assignedUserId?: string }, userClientId?: string | null): Promise<FullOnboarding> {
    const where: Prisma.ClientOnboardingWhereInput = { id };
    if (userClientId) where.clientId = userClientId;
    // First find to make sure it exists and we can get id for update
    const existing = await prismaRead.clientOnboarding.findFirst({ where, select: { id: true } });
    if (!existing) throw new Error("Onboarding not found");
    return prisma.clientOnboarding.update({ where: { id: existing.id }, data, include: fullOnboardingInclude });
  },

  async delete(id: string, userClientId?: string | null): Promise<ClientOnboarding> {
    const where: Prisma.ClientOnboardingWhereInput = { id };
    if (userClientId) where.clientId = userClientId;
    const existing = await prismaRead.clientOnboarding.findFirst({ where, select: { id: true } });
    if (!existing) throw new Error("Onboarding not found");
    return prisma.clientOnboarding.delete({ where: { id: existing.id } });
  },

  async addStep(onboardingId: string, data: Omit<Prisma.OnboardingStepCreateInput, "onboarding">, userClientId?: string | null): Promise<OnboardingStep> {
    const where: Prisma.ClientOnboardingWhereInput = { id: onboardingId };
    if (userClientId) where.clientId = userClientId;
    await prisma.clientOnboarding.findFirstOrThrow({ where, select: { id: true } });
    return prisma.onboardingStep.create({ data: { onboarding: { connect: { id: onboardingId } }, ...data } });
  },

  async updateStep(stepId: string, data: Prisma.OnboardingStepUpdateInput, userClientId?: string | null): Promise<OnboardingStep> {
    // Find step and check if parent onboarding belongs to userClientId
    const step = await prismaRead.onboardingStep.findFirst({
      where: {
        id: stepId,
        ...(userClientId ? { onboarding: { clientId: userClientId } } : {})
      },
      select: { id: true }
    });
    if (!step) throw new Error("Step not found");
    return prisma.onboardingStep.update({
      where: { id: step.id },
      data,
      include: { contract: true, payment: true, questionnaire: true, specifications: true, kickoff: true, production: true, delivery: true },
    });
  },

  async createContract(stepId: string, data: Omit<Prisma.ContractCreateInput, "onboardingStep">, userClientId?: string | null): Promise<Contract> {
    const step = await prismaRead.onboardingStep.findFirst({
      where: {
        id: stepId,
        ...(userClientId ? { onboarding: { clientId: userClientId } } : {})
      },
      select: { id: true }
    });
    if (!step) throw new Error("Step not found");
    return prisma.contract.create({ data: { onboardingStep: { connect: { id: step.id } }, ...data } });
  },

  async updateContract(contractId: string, data: Prisma.ContractUpdateInput, userClientId?: string | null): Promise<Contract> {
    const contract = await prismaRead.contract.findFirst({
      where: {
        id: contractId,
        ...(userClientId ? { onboardingStep: { onboarding: { clientId: userClientId } } } : {})
      },
      select: { id: true }
    });
    if (!contract) throw new Error("Contract not found");
    return prisma.contract.update({ where: { id: contract.id }, data });
  },

  async createPayment(stepId: string, data: Omit<Prisma.PaymentCreateInput, "onboardingStep">, userClientId?: string | null): Promise<Payment> {
    const step = await prismaRead.onboardingStep.findFirst({
      where: {
        id: stepId,
        ...(userClientId ? { onboarding: { clientId: userClientId } } : {})
      },
      select: { id: true }
    });
    if (!step) throw new Error("Step not found");
    return prisma.payment.create({ data: { onboardingStep: { connect: { id: step.id } }, ...data } });
  },

  async updatePayment(paymentId: string, data: Prisma.PaymentUpdateInput, userClientId?: string | null): Promise<Payment> {
    const payment = await prismaRead.payment.findFirst({
      where: {
        id: paymentId,
        ...(userClientId ? { onboardingStep: { onboarding: { clientId: userClientId } } } : {})
      },
      select: { id: true }
    });
    if (!payment) throw new Error("Payment not found");
    return prisma.payment.update({ where: { id: payment.id }, data });
  },

  async createQuestionnaire(
    stepId: string,
    data: { serviceType?: string; data?: unknown; isDraft?: boolean },
    userClientId?: string | null
  ): Promise<Questionnaire> {
    const step = await prismaRead.onboardingStep.findFirst({
      where: {
        id: stepId,
        ...(userClientId ? { onboarding: { clientId: userClientId } } : {})
      },
      select: { id: true }
    });
    if (!step) throw new Error("Step not found");
    // serviceType is required at the DB level; cast keeps the original behaviour
    // (Prisma rejects at runtime if it is genuinely missing) instead of masking it.
    const createData = {
      onboardingStep: { connect: { id: step.id } },
      serviceType: data.serviceType,
      isDraft: data.isDraft,
    } as Prisma.QuestionnaireCreateInput;
    if (data.data !== undefined) createData.data = data.data as Prisma.InputJsonValue;
    return prisma.questionnaire.create({ data: createData });
  },

  async updateQuestionnaire(
    questionnaireId: string,
    data: { serviceType?: string; data?: unknown; isDraft?: boolean },
    userClientId?: string | null
  ): Promise<Questionnaire> {
    const questionnaire = await prismaRead.questionnaire.findFirst({
      where: {
        id: questionnaireId,
        ...(userClientId ? { onboardingStep: { onboarding: { clientId: userClientId } } } : {})
      },
      select: { id: true }
    });
    if (!questionnaire) throw new Error("Questionnaire not found");
    const updateData: Prisma.QuestionnaireUpdateInput = {
      serviceType: data.serviceType,
      isDraft: data.isDraft,
    };
    if (data.data !== undefined) updateData.data = data.data as Prisma.InputJsonValue;
    return prisma.questionnaire.update({ where: { id: questionnaire.id }, data: updateData });
  },

  async createSpecifications(stepId: string, data: Omit<Prisma.SpecificationsCreateInput, "onboardingStep">, userClientId?: string | null): Promise<Specifications> {
    const step = await prismaRead.onboardingStep.findFirst({
      where: {
        id: stepId,
        ...(userClientId ? { onboarding: { clientId: userClientId } } : {})
      },
      select: { id: true }
    });
    if (!step) throw new Error("Step not found");
    return prisma.specifications.create({ data: { onboardingStep: { connect: { id: step.id } }, ...data } });
  },

  async updateSpecifications(specificationsId: string, data: Prisma.SpecificationsUpdateInput, userClientId?: string | null): Promise<Specifications> {
    const spec = await prismaRead.specifications.findFirst({
      where: {
        id: specificationsId,
        ...(userClientId ? { onboardingStep: { onboarding: { clientId: userClientId } } } : {})
      },
      select: { id: true }
    });
    if (!spec) throw new Error("Specifications not found");
    return prisma.specifications.update({ where: { id: spec.id }, data });
  },

  async createKickoff(stepId: string, data: Omit<Prisma.KickoffMeetingCreateInput, "onboardingStep">, userClientId?: string | null): Promise<KickoffMeeting> {
    const step = await prismaRead.onboardingStep.findFirst({
      where: {
        id: stepId,
        ...(userClientId ? { onboarding: { clientId: userClientId } } : {})
      },
      select: { id: true }
    });
    if (!step) throw new Error("Step not found");
    return prisma.kickoffMeeting.create({ data: { onboardingStep: { connect: { id: step.id } }, ...data } });
  },

  async updateKickoff(kickoffId: string, data: Prisma.KickoffMeetingUpdateInput, userClientId?: string | null): Promise<KickoffMeeting> {
    const kickoff = await prismaRead.kickoffMeeting.findFirst({
      where: {
        id: kickoffId,
        ...(userClientId ? { onboardingStep: { onboarding: { clientId: userClientId } } } : {})
      },
      select: { id: true }
    });
    if (!kickoff) throw new Error("Kickoff not found");
    return prisma.kickoffMeeting.update({ where: { id: kickoff.id }, data });
  },

  async createProduction(stepId: string, data: Omit<Prisma.ProductionProgressCreateInput, "onboardingStep">, userClientId?: string | null): Promise<ProductionProgress> {
    const step = await prismaRead.onboardingStep.findFirst({
      where: {
        id: stepId,
        ...(userClientId ? { onboarding: { clientId: userClientId } } : {})
      },
      select: { id: true }
    });
    if (!step) throw new Error("Step not found");
    return prisma.productionProgress.create({ data: { onboardingStep: { connect: { id: step.id } }, analysis: 0, design: 0, development: 0, testing: 0, deployment: 0, ...data } });
  },

  async updateProduction(productionId: string, data: Prisma.ProductionProgressUpdateInput, userClientId?: string | null): Promise<ProductionProgress> {
    const production = await prismaRead.productionProgress.findFirst({
      where: {
        id: productionId,
        ...(userClientId ? { onboardingStep: { onboarding: { clientId: userClientId } } } : {})
      },
      select: { id: true }
    });
    if (!production) throw new Error("Production not found");
    return prisma.productionProgress.update({ where: { id: production.id }, data });
  },

  async createDelivery(stepId: string, data: Omit<Prisma.DeliveryCreateInput, "onboardingStep">, userClientId?: string | null): Promise<Delivery> {
    const step = await prismaRead.onboardingStep.findFirst({
      where: {
        id: stepId,
        ...(userClientId ? { onboarding: { clientId: userClientId } } : {})
      },
      select: { id: true }
    });
    if (!step) throw new Error("Step not found");
    return prisma.delivery.create({ data: { onboardingStep: { connect: { id: step.id } }, ...data } });
  },

  async updateDelivery(deliveryId: string, data: Prisma.DeliveryUpdateInput, userClientId?: string | null): Promise<Delivery> {
    const delivery = await prismaRead.delivery.findFirst({
      where: {
        id: deliveryId,
        ...(userClientId ? { onboardingStep: { onboarding: { clientId: userClientId } } } : {})
      },
      select: { id: true }
    });
    if (!delivery) throw new Error("Delivery not found");
    return prisma.delivery.update({ where: { id: delivery.id }, data });
  },
};
