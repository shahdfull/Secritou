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

// ─── Shared include shape used by findById / findByProjectId ─────────────────

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

type FullOnboarding = Prisma.ClientOnboardingGetPayload<{
  include: typeof fullOnboardingInclude;
}>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildOrderBy(orderBy: string | undefined, orderDir: "asc" | "desc") {
  const allowed = ["createdAt", "updatedAt"];
  const field = orderBy && allowed.includes(orderBy) ? orderBy : "createdAt";
  return { [field]: orderDir };
}

function buildWhere(search?: string, companyId?: string, clientId?: string): Prisma.ClientOnboardingWhereInput {
  const where: Prisma.ClientOnboardingWhereInput = {};

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

// ─── Repository ───────────────────────────────────────────────────────────────

export const clientOnboardingRepository = {
  async findAll(
    options: ListQueryOptions & { search?: string; companyId?: string; clientId?: string }
  ): Promise<PaginatedResult<ClientOnboarding & { client: Pick<Client, "id" | "name">; project: Pick<Project, "id" | "name"> | null }>> {
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

  async findById(id: string, companyId: string): Promise<FullOnboarding | null> {
    return prismaRead.clientOnboarding.findUnique({
      where: { id, companyId },
      include: fullOnboardingInclude,
    });
  },

  async findByProjectId(projectId: string, companyId: string): Promise<FullOnboarding | null> {
    return prismaRead.clientOnboarding.findUnique({
      where: { projectId, project: { companyId } },
      include: fullOnboardingInclude,
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
  }): Promise<FullOnboarding> {
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
      include: fullOnboardingInclude,
    });
  },

  async update(
    id: string,
    companyId: string,
    data: Prisma.ClientOnboardingUpdateInput
  ): Promise<FullOnboarding> {
    return prisma.clientOnboarding.update({
      where: { id, companyId },
      data,
      include: fullOnboardingInclude,
    });
  },

  async delete(id: string, companyId: string): Promise<ClientOnboarding> {
    return prisma.clientOnboarding.delete({ where: { id, companyId } });
  },

  // ── Step operations ────────────────────────────────────────────────────────

  async addStep(
    onboardingId: string,
    companyId: string,
    data: Omit<Prisma.OnboardingStepCreateInput, "onboarding">
  ): Promise<OnboardingStep> {
    await prisma.clientOnboarding.findUniqueOrThrow({
      where: { id: onboardingId, companyId },
      select: { id: true },
    });
    return prisma.onboardingStep.create({
      data: {
        onboarding: { connect: { id: onboardingId } },
        ...data,
      },
    });
  },

  async updateStep(
    stepId: string,
    companyId: string,
    data: Prisma.OnboardingStepUpdateInput
  ): Promise<OnboardingStep> {
    return prisma.onboardingStep.update({
      where: { id: stepId, onboarding: { companyId } },
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

  // ── Contract operations ────────────────────────────────────────────────────

  async createContract(
    stepId: string,
    companyId: string,
    data: Omit<Prisma.ContractCreateInput, "onboardingStep">
  ): Promise<Contract> {
    await prisma.onboardingStep.findUniqueOrThrow({
      where: { id: stepId, onboarding: { companyId } },
      select: { id: true },
    });
    return prisma.contract.create({
      data: {
        onboardingStep: { connect: { id: stepId } },
        ...data,
      },
    });
  },

  async updateContract(
    contractId: string,
    companyId: string,
    data: Prisma.ContractUpdateInput
  ): Promise<Contract> {
    return prisma.contract.update({
      where: { id: contractId, onboardingStep: { onboarding: { companyId } } },
      data,
    });
  },

  // ── Payment operations ─────────────────────────────────────────────────────

  async createPayment(
    stepId: string,
    companyId: string,
    data: Omit<Prisma.PaymentCreateInput, "onboardingStep">
  ): Promise<Payment> {
    await prisma.onboardingStep.findUniqueOrThrow({
      where: { id: stepId, onboarding: { companyId } },
      select: { id: true },
    });
    return prisma.payment.create({
      data: {
        onboardingStep: { connect: { id: stepId } },
        ...data,
      },
    });
  },

  async updatePayment(
    paymentId: string,
    companyId: string,
    data: Prisma.PaymentUpdateInput
  ): Promise<Payment> {
    return prisma.payment.update({
      where: { id: paymentId, onboardingStep: { onboarding: { companyId } } },
      data,
    });
  },

  // ── Questionnaire operations ───────────────────────────────────────────────

  async createQuestionnaire(
    stepId: string,
    companyId: string,
    data: Omit<Prisma.QuestionnaireCreateInput, "onboardingStep">
  ): Promise<Questionnaire> {
    await prisma.onboardingStep.findUniqueOrThrow({
      where: { id: stepId, onboarding: { companyId } },
      select: { id: true },
    });
    return prisma.questionnaire.create({
      data: {
        onboardingStep: { connect: { id: stepId } },
        ...data,
      },
    });
  },

  async updateQuestionnaire(
    questionnaireId: string,
    companyId: string,
    data: Prisma.QuestionnaireUpdateInput
  ): Promise<Questionnaire> {
    return prisma.questionnaire.update({
      where: { id: questionnaireId, onboardingStep: { onboarding: { companyId } } },
      data,
    });
  },

  // ── Specifications operations ──────────────────────────────────────────────

  async createSpecifications(
    stepId: string,
    companyId: string,
    data: Omit<Prisma.SpecificationsCreateInput, "onboardingStep">
  ): Promise<Specifications> {
    await prisma.onboardingStep.findUniqueOrThrow({
      where: { id: stepId, onboarding: { companyId } },
      select: { id: true },
    });
    return prisma.specifications.create({
      data: {
        onboardingStep: { connect: { id: stepId } },
        ...data,
      },
    });
  },

  async updateSpecifications(
    specificationsId: string,
    companyId: string,
    data: Prisma.SpecificationsUpdateInput
  ): Promise<Specifications> {
    return prisma.specifications.update({
      where: { id: specificationsId, onboardingStep: { onboarding: { companyId } } },
      data,
    });
  },

  // ── Kickoff operations ─────────────────────────────────────────────────────

  async createKickoff(
    stepId: string,
    companyId: string,
    data: Omit<Prisma.KickoffMeetingCreateInput, "onboardingStep">
  ): Promise<KickoffMeeting> {
    await prisma.onboardingStep.findUniqueOrThrow({
      where: { id: stepId, onboarding: { companyId } },
      select: { id: true },
    });
    return prisma.kickoffMeeting.create({
      data: {
        onboardingStep: { connect: { id: stepId } },
        ...data,
      },
    });
  },

  async updateKickoff(
    kickoffId: string,
    companyId: string,
    data: Prisma.KickoffMeetingUpdateInput
  ): Promise<KickoffMeeting> {
    return prisma.kickoffMeeting.update({
      where: { id: kickoffId, onboardingStep: { onboarding: { companyId } } },
      data,
    });
  },

  // ── Production operations ──────────────────────────────────────────────────

  async createProduction(
    stepId: string,
    companyId: string,
    data: Omit<Prisma.ProductionProgressCreateInput, "onboardingStep">
  ): Promise<ProductionProgress> {
    await prisma.onboardingStep.findUniqueOrThrow({
      where: { id: stepId, onboarding: { companyId } },
      select: { id: true },
    });
    return prisma.productionProgress.create({
      data: {
        onboardingStep: { connect: { id: stepId } },
        analysis: 0,
        design: 0,
        development: 0,
        testing: 0,
        deployment: 0,
        ...data,
      },
    });
  },

  async updateProduction(
    productionId: string,
    companyId: string,
    data: Prisma.ProductionProgressUpdateInput
  ): Promise<ProductionProgress> {
    return prisma.productionProgress.update({
      where: { id: productionId, onboardingStep: { onboarding: { companyId } } },
      data,
    });
  },

  // ── Delivery operations ────────────────────────────────────────────────────

  async createDelivery(
    stepId: string,
    companyId: string,
    data: Omit<Prisma.DeliveryCreateInput, "onboardingStep">
  ): Promise<Delivery> {
    await prisma.onboardingStep.findUniqueOrThrow({
      where: { id: stepId, onboarding: { companyId } },
      select: { id: true },
    });
    return prisma.delivery.create({
      data: {
        onboardingStep: { connect: { id: stepId } },
        ...data,
      },
    });
  },

  async updateDelivery(
    deliveryId: string,
    companyId: string,
    data: Prisma.DeliveryUpdateInput
  ): Promise<Delivery> {
    return prisma.delivery.update({
      where: { id: deliveryId, onboardingStep: { onboarding: { companyId } } },
      data,
    });
  },
};
