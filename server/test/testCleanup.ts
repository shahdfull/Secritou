// SEC-073: importing (directly or transitively) any service that goes through jobs/queues.ts
// (enqueueEmails/enqueueNotifications/etc.) opens a real BullMQ/ioredis connection at module
// scope, even when the test never enqueues anything. Without closing it, `node --test` never
// exits when the file runs alone (npx tsx --test <file>).
//
// Call this from the file's own after() so it also runs correctly in isolation:
//
//   import { after } from "node:test";
//   import { closeJobQueueConnections } from "./testCleanup.js";
//   after(closeJobQueueConnections);
//
// NOT safe to call unconditionally from a file also imported by run-all.test.ts: closing the
// shared connection mid-run would hang every file imported afterward in that same run, which is
// exactly what happened the first time this was tried (SEC-073 regression, caught by running the
// full suite after adding this to two files). run-all.test.ts sets
// process.env.__RUN_ALL_AGGREGATOR__ = "true" before its own imports specifically so this
// function can detect "I'm one file among many in the aggregator, its own after() at the bottom
// of run-all.test.ts already owns this cleanup" and no-op instead.
export async function closeJobQueueConnections() {
  if (process.env.__RUN_ALL_AGGREGATOR__) return;
  const { communicationQueue, maintenanceQueue, documentsQueue } = await import("../src/jobs/queues.js");
  const { getBullRedisConnection } = await import("../src/jobs/redisConnection.js");
  await Promise.all([
    communicationQueue.close(),
    maintenanceQueue.close(),
    documentsQueue.close(),
  ]);
  await getBullRedisConnection().quit();
}
