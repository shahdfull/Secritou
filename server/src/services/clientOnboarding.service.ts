import { clientOnboardingRepository } from "../repositories/clientOnboarding.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { clientRepository } from "../repositories/client.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { enqueueEmails } from "../jobs/queues.js";
import { onboardingStepCompletedTemplate } from "./emailTemplates/index.js";
import { prismaRead } from "../config/prisma.js";
import type { ListQueryOptions } from "../utils/listQuery.js";
import type { PaymentStatus, Prisma } from "@prisma/client";
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

// SEC-029: onboarding's Payment step must reflect the project's real DEPOSIT invoice (created
// by proposal.service.ts#acceptWithCascade, RG-004a) rather than accept an arbitrary
// amount/amountPaid/status from the caller — those three fields are derived here, never trusted
// as input.
function mapInvoiceStatusToPaymentStatus(invoiceStatus: string): PaymentStatus {
  if (invoiceStatus === "PAID") return "PAID";
  if (invoiceStatus === "PARTIAL") return "PARTIAL";
  return "UNPAID";
}

async function getDepositInvoiceForProject(projectId: string) {
  return prismaRead.invoice.findFirst({
    where: { projectId, invoiceType: "DEPOSIT" },
    select: { id: true, amount: true, amountPaid: true, status: true },
  });
}

export const clientOnboardingService = {
  async getAllOnboardings(options: ListQueryOptions & { search?: string; clientId?: string }, userClientId?: string | null, managerServiceId?: string | null) {
    return clientOnboardingRepository.findAll(options, userClientId, managerServiceId);
  },

  async getOnboardingById(id: string, userClientId?: string | null, managerServiceId?: string | null) {
    return clientOnboardingRepository.findById(id, userClientId, managerServiceId);
  },

  async getOnboardingByProjectId(projectId: string, userClientId?: string | null, managerServiceId?: string | null) {
    return clientOnboardingRepository.findByProjectId(projectId, userClientId, managerServiceId);
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

  async updateOnboarding(id: string, data: UpdateOnboardingInput, userClientId?: string | null, managerServiceId?: string | null) {
    return clientOnboardingRepository.update(id, data, userClientId, managerServiceId);
  },

  async deleteOnboarding(id: string, userClientId?: string | null, managerServiceId?: string | null) {
    return clientOnboardingRepository.delete(id, userClientId, managerServiceId);
  },

  async addStep(onboardingId: string, data: Parameters<typeof clientOnboardingRepository.addStep>[1], userClientId?: string | null, managerServiceId?: string | null) {
    return clientOnboardingRepository.addStep(onboardingId, data, userClientId, managerServiceId);
  },

  async updateStep(stepId: string, data: UpdateStepInput, userClientId?: string | null, managerServiceId?: string | null) {
    const step = await clientOnboardingRepository.updateStep(stepId, data, userClientId, managerServiceId);

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

  async createContract(stepId: string, data: ContractInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.createContract(stepId, data, userClientId, managerServiceId); },
  async updateContract(contractId: string, data: ContractInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.updateContract(contractId, data, userClientId, managerServiceId); },
  async createPayment(stepId: string, data: PaymentInput, userClientId?: string | null, managerServiceId?: string | null) {
    const step = await prismaRead.onboardingStep.findUnique({
      where: { id: stepId },
      select: { onboarding: { select: { projectId: true } } },
    });
    const invoice = step ? await getDepositInvoiceForProject(step.onboarding.projectId) : null;
    const derived: Omit<Prisma.PaymentCreateInput, "onboardingStep"> = {
      deadline: data.deadline,
      status: invoice ? mapInvoiceStatusToPaymentStatus(invoice.status) : "UNPAID",
      ...(invoice
        ? { invoice: { connect: { id: invoice.id } }, amount: Number(invoice.amount), amountPaid: Number(invoice.amountPaid) }
        : {}),
    };
    return clientOnboardingRepository.createPayment(stepId, derived, userClientId, managerServiceId);
  },
  async updatePayment(paymentId: string, data: PaymentInput, userClientId?: string | null, managerServiceId?: string | null) {
    const payment = await prismaRead.payment.findUnique({
      where: { id: paymentId },
      select: { onboardingStep: { select: { onboarding: { select: { projectId: true } } } } },
    });
    const projectId = payment?.onboardingStep?.onboarding.projectId;
    const invoice = projectId ? await getDepositInvoiceForProject(projectId) : null;
    const derived: Prisma.PaymentUpdateInput = {
      deadline: data.deadline,
      status: invoice ? mapInvoiceStatusToPaymentStatus(invoice.status) : "UNPAID",
      ...(invoice
        ? { invoice: { connect: { id: invoice.id } }, amount: Number(invoice.amount), amountPaid: Number(invoice.amountPaid) }
        : {}),
    };
    return clientOnboardingRepository.updatePayment(paymentId, derived, userClientId, managerServiceId);
  },
  async createQuestionnaire(stepId: string, data: QuestionnaireInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.createQuestionnaire(stepId, data, userClientId, managerServiceId); },
  async updateQuestionnaire(questionnaireId: string, data: QuestionnaireInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.updateQuestionnaire(questionnaireId, data, userClientId, managerServiceId); },
  async createSpecifications(stepId: string, data: SpecificationsInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.createSpecifications(stepId, data, userClientId, managerServiceId); },
  async updateSpecifications(specificationsId: string, data: SpecificationsInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.updateSpecifications(specificationsId, data, userClientId, managerServiceId); },
  async createKickoff(stepId: string, data: KickoffInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.createKickoff(stepId, data, userClientId, managerServiceId); },
  async updateKickoff(kickoffId: string, data: KickoffInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.updateKickoff(kickoffId, data, userClientId, managerServiceId); },
  async createProduction(stepId: string, data: ProductionInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.createProduction(stepId, data, userClientId, managerServiceId); },
  async updateProduction(productionId: string, data: ProductionInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.updateProduction(productionId, data, userClientId, managerServiceId); },
  async createDelivery(stepId: string, data: DeliveryInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.createDelivery(stepId, data, userClientId, managerServiceId); },
  async updateDelivery(deliveryId: string, data: DeliveryInput, userClientId?: string | null, managerServiceId?: string | null) { return clientOnboardingRepository.updateDelivery(deliveryId, data, userClientId, managerServiceId); },
};
