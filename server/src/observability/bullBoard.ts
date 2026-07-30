// SEC-032: @bull-board/api and @bull-board/express were declared in package.json but never
// mounted anywhere — a real-time view of BullMQ queues/jobs existed only as an unused
// dependency. Decision of the project owner (AskUserQuestion, 2026-07-30): mount a real
// dashboard, gated ADMIN-only, rather than remove the dependency.
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { communicationQueue, maintenanceQueue, documentsQueue } from "../jobs/queues.js";

export const BULL_BOARD_BASE_PATH = "/api/v1/admin/queues";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(BULL_BOARD_BASE_PATH);

createBullBoard({
  queues: [
    new BullMQAdapter(communicationQueue),
    new BullMQAdapter(maintenanceQueue),
    new BullMQAdapter(documentsQueue),
  ],
  serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();
