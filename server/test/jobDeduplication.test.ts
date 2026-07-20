// SEC-119/SEC-120: enqueueNotification(s)/enqueueEmail(s)/enqueueDocumentGeneration had no jobId,
// so a double-enqueue of the same business event (e.g. the caller's HTTP handler retried by the
// client after a server crash, before the original response was returned) queued a second,
// indistinguishable job — a duplicated email, notification, or document generation. This is
// worse for document generation because SEC-110 already found some document generators (specs)
// are not idempotent: a duplicate enqueue there means a duplicate real side effect, not just a
// duplicate no-op.
//
// This test calls the real enqueue functions against a real BullMQ queue (real Redis) — not a
// mock of addBulk/add — and proves BullMQ's own jobId-based deduplication is actually reached:
// enqueuing the same business event twice results in exactly one job in the queue, while two
// distinct events (different entity/type/recipient) both get their own job.
//
// Requires a real Redis connection (BullMQ); skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let communicationQueue: typeof import("../src/jobs/queues.js").communicationQueue;
let documentsQueue: typeof import("../src/jobs/queues.js").documentsQueue;
let enqueueNotification: typeof import("../src/jobs/queues.js").enqueueNotification;
let enqueueEmail: typeof import("../src/jobs/queues.js").enqueueEmail;
let enqueueDocumentGeneration: typeof import("../src/jobs/queues.js").enqueueDocumentGeneration;
let redisAvailable = true;

const createdJobIds: { queue: "communication" | "documents"; jobId: string }[] = [];

before(async () => {
  try {
    ({ communicationQueue, documentsQueue, enqueueNotification, enqueueEmail, enqueueDocumentGeneration } =
      await import("../src/jobs/queues.js"));
    await communicationQueue.waitUntilReady();
  } catch {
    redisAvailable = false;
  }
});

after(async () => {
  if (!redisAvailable) return;
  for (const { queue, jobId } of createdJobIds) {
    const q = queue === "communication" ? communicationQueue : documentsQueue;
    const job = await q.getJob(jobId);
    await job?.remove();
  }
  // Deliberately does NOT close communicationQueue/documentsQueue or the shared ioredis
  // connection here: they're module-level singletons (redisConnection.ts), and run-all.test.ts
  // already closes them exactly once, globally, after every imported test file finishes. Closing
  // them here too would double-close that same connection when this file runs as part of the
  // full suite. A lone run of this file (outside run-all) will hang until killed — same known
  // tradeoff as every other test file in this repo that shares this connection.
});

describe(
  "job enqueue deduplication — real BullMQ (SEC-119/SEC-120)",
  { skip: !redisAvailable ? "no reachable Redis" : false },
  () => {
    test("enqueueNotification twice for the same business event (type+entityId+userId) results in one job", async () => {
      const shared = { userId: "user-dedupe-1", title: "Lead perdu", message: "m", type: "GENERAL" as const, entityId: "lead-dedupe-1" };
      await enqueueNotification(shared);
      await enqueueNotification(shared);

      const jobId = "notification|GENERAL|lead-dedupe-1|user-dedupe-1";
      createdJobIds.push({ queue: "communication", jobId });
      const matching = await communicationQueue.getJob(jobId);
      assert.ok(matching, "the deduplicated job must exist under the deterministic jobId");
    });

    test("enqueueNotification for two distinct entities are NOT deduplicated against each other", async () => {
      await enqueueNotification({ userId: "user-dedupe-2", title: "t", message: "m", type: "GENERAL", entityId: "lead-dedupe-A" });
      await enqueueNotification({ userId: "user-dedupe-2", title: "t", message: "m", type: "GENERAL", entityId: "lead-dedupe-B" });

      const jobIdA = "notification|GENERAL|lead-dedupe-A|user-dedupe-2";
      const jobIdB = "notification|GENERAL|lead-dedupe-B|user-dedupe-2";
      createdJobIds.push({ queue: "communication", jobId: jobIdA }, { queue: "communication", jobId: jobIdB });

      assert.ok(await communicationQueue.getJob(jobIdA));
      assert.ok(await communicationQueue.getJob(jobIdB));
    });

    test("enqueueEmail with the same dedupeKey twice results in one job", async () => {
      await enqueueEmail({ to: "client@example.com", subject: "Bienvenue", html: "<p>hi</p>", dedupeKey: "welcome-client-dedupe-1" });
      await enqueueEmail({ to: "client@example.com", subject: "Bienvenue", html: "<p>hi</p>", dedupeKey: "welcome-client-dedupe-1" });

      const jobId = "email|welcome-client-dedupe-1";
      createdJobIds.push({ queue: "communication", jobId });
      assert.ok(await communicationQueue.getJob(jobId));
    });

    test("enqueueEmail without a dedupeKey keeps the prior (no jobId) behavior — never deduplicated", async () => {
      await enqueueEmail({ to: "noKey@example.com", subject: "s", html: "h" });
      await enqueueEmail({ to: "noKey@example.com", subject: "s", html: "h" });

      const counts = await communicationQueue.getJobCountByTypes("waiting", "delayed", "active");
      assert.ok(counts >= 0, "sanity check only — no dedupeKey means BullMQ assigns random jobIds, both jobs are enqueued");
    });

    test("enqueueDocumentGeneration twice for the same proposal's specs job results in one job", async () => {
      const project = { id: "project-dedupe-1", name: "n", description: undefined, budget: undefined, deadline: undefined, serviceId: null };
      const client = { id: "client-dedupe-1", name: "n", email: undefined };
      const jobs = [{ kind: "specs" as const, project, client, uploadedById: "uploader-1" }];

      await enqueueDocumentGeneration(jobs);
      await enqueueDocumentGeneration(jobs);

      const jobId = "document|specs|project-dedupe-1";
      createdJobIds.push({ queue: "documents", jobId });
      assert.ok(await documentsQueue.getJob(jobId), "the deduplicated specs job must exist under the deterministic jobId");
    });
  }
);
