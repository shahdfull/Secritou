import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";

export const tenantValidation = {
  async assertCompanyOwnedByUser(companyId: string, userCompanyId: string | null | undefined) {
    if (!userCompanyId || companyId !== userCompanyId) {
      throw new HttpError(403, "Company access denied");
    }
    const company = await prisma.company.findFirst({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new HttpError(404, "Company not found");
    return company;
  },

  async assertClientInCompany(clientId: string, companyId: string) {
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId }, select: { id: true } });
    if (!client) throw new HttpError(404, "Client not found");
    return client;
  },

  async assertProjectInCompany(projectId: string, companyId: string) {
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } });
    if (!project) throw new HttpError(400, "Invalid project for this company");
    return project;
  },

  async assertUserInCompany(userId: string, companyId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, companyId }, select: { id: true } });
    if (!user) throw new HttpError(400, "Invalid user for this company");
    return user;
  },

  async assertProjectAndClientInCompany(projectId: string | undefined, clientId: string | undefined, companyId: string) {
    if (clientId) await this.assertClientInCompany(clientId, companyId);
    if (projectId) await this.assertProjectInCompany(projectId, companyId);
  },

  async assertServiceRequestInCompany(serviceRequestId: string, companyId: string) {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: serviceRequestId, companyId },
      select: { id: true },
    });
    if (!request) throw new HttpError(404, "Service request not found");
    return request;
  },

  // Premium module validations
  async assertProposalInCompany(proposalId: string, companyId: string) {
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, companyId },
      select: { id: true, companyId: true },
    });
    if (!proposal) throw new HttpError(404, "Proposal not found");
    return proposal;
  },

  async assertApprovalInCompany(approvalId: string, companyId: string) {
    const approval = await prisma.approval.findFirst({
      where: { id: approvalId, companyId },
      select: { id: true, companyId: true },
    });
    if (!approval) throw new HttpError(404, "Approval not found");
    return approval;
  },

  async assertInvoiceInCompany(invoiceId: string, companyId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true, companyId: true },
    });
    if (!invoice) throw new HttpError(404, "Invoice not found");
    return invoice;
  },

  async assertDocumentInCompany(docId: string, companyId: string) {
    const doc = await prisma.document.findFirst({
      where: { id: docId, companyId },
      select: { id: true, companyId: true },
    });
    if (!doc) throw new HttpError(404, "Document not found");
    return doc;
  },

  async assertClientSuccessInCompany(clientId: string, companyId: string) {
    const client = await this.assertClientInCompany(clientId, companyId);
    return client;
  },
};
