import { clientPortalRepository } from "../repositories/clientPortal.repository.js";

export const clientPortalService = {
  async getSummary(clientId: string) {
    const [outstandingBalance, nextDueInvoice, currentProject] = await Promise.all([
      clientPortalRepository.getOutstandingBalance(clientId),
      clientPortalRepository.getNextDueInvoice(clientId),
      clientPortalRepository.getCurrentProjectProgress(clientId),
    ]);

    return { outstandingBalance, nextDueInvoice, currentProject };
  },
};
