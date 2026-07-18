import { after } from "node:test";
import { communicationQueue, maintenanceQueue, documentsQueue } from "../src/jobs/queues.js";
import { getBullRedisConnection } from "../src/jobs/redisConnection.js";

// Importing auth.service.ts (via auth.service.test.ts below) loads jobs/queues.ts at module
// scope, which opens a real BullMQ/ioredis connection even though the tests inject a fake DB
// and never enqueue anything. Without closing it, node --test never exits after the last test.
after(async () => {
  await Promise.all([
    communicationQueue.close(),
    maintenanceQueue.close(),
    documentsQueue.close(),
  ]);
  await getBullRedisConnection().quit();
});

import "./auth.middleware.test.ts";
import "./rbac.test.ts";
import "./rateLimit.test.ts";
import "./listQuery.test.ts";
import "./invoice.service.test.ts";
import "./lead.repository.test.ts";
import "./proposal.service.test.ts";
import "./proposalAcceptCascade.test.ts";
import "./project.clientApprove.test.ts";
import "./freelancerAvailability.test.ts";
import "./auth.service.test.ts";
import "./user.service.test.ts";
import "./validators.test.ts";
import "./idor.test.ts";
import "./businessGuards.test.ts";
import "./leadService.test.ts";
import "./searchScope.test.ts";
import "./taskScope.test.ts";
import "./financeAccess.test.ts";
import "./documentAccess.test.ts";
import "./ai.endpoint.test.ts";
import "./freelancerApplicationUpload.test.ts";
import "./honeypot.test.ts";
import "./contactValidator.test.ts";
import "./bookingValidator.test.ts";
import "./booking.service.test.ts";
import "./booking.routes.test.ts";
import "./analyticsEventValidator.test.ts";
import "./analyticsEvent.routes.test.ts";
import "./analyticsCommissionScope.test.ts";
import "./projectUpdateBlocksCompletion.test.ts";
import "./userProfilePhone.http.test.ts";
import "./checkInvoiceFollowup.test.ts";
import "./briefQuestions.test.ts";
import "./portalActivationOnPayment.test.ts";
import "./creditNoteApply.test.ts";
import "./documentSignContract.test.ts";
import "./executiveMetricsProjectRisks.test.ts";
import "./commissionCreationExclusivity.test.ts";
import "./proposalCreationScope.test.ts";
import "./aiExecutionAccessClient.test.ts";
import "./projectClientApproveBalanceInvoice.test.ts";
import "./invoiceNumberingGapless.test.ts";
import "./currencyRejectsNonTnd.test.ts";
import "./projectDetailIncludesTasks.test.ts";
import "./freelancerSeesOwnDeliverable.test.ts";
import "./projectStatusInFilter.test.ts";
import "./managerScopeIdorFixes.test.ts";
import "./prismaReadWriteSeparation.test.ts";
import "./projectCreateArchiveRestore.test.ts";
import "./archivedProjectTaskVisibility.test.ts";
