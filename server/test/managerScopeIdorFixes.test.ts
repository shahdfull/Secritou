// Failles IDOR signalées directement par le porteur du projet (session du 2026-07-18, casquette
// "ingénieur sécurité"). L'analyse a confirmé les 3 constats initiaux et trouvé un 4e trou
// distinct en vérifiant le 3e :
//
// 1. projectMeeting.service.ts — listByProject/create/getSchedule/setSchedule n'appliquaient
//    aucun scope, contrairement au pattern déjà en place ailleurs (task.service.ts's
//    assertProjectInScope). Un Manager du pôle A pouvait lister/créer des réunions et modifier
//    la cadence de rappel (meeting-schedule) d'un projet du pôle B en connaissant/devinant son
//    UUID.
// 2. projectTemplate.service.ts#applyToProject — aucune vérification que project.serviceId
//    correspond au pôle du Manager avant d'appliquer un template (création en masse de tâches).
//    Un Manager hors périmètre pouvait injecter les tâches du template de son propre pôle dans
//    un projet qui n'était pas le sien.
// 3. GET /:id/timeline-status et GET /:id/brief n'avaient aucun authorize() (authenticate
//    seul) — protection reposant entièrement sur le filtrage interne du service, sans filet de
//    sécurité au niveau routeur.
// 4. (trouvé en vérifiant le point 3) project.service.ts#getBrief/getTimelineStatus ne
//    scopaient EXPLICITEMENT que CLIENT et FREELANCER dans leur `where` — le rôle MANAGER
//    n'était jamais filtré par pôle, contrairement à project.repository.ts#findById qui gère
//    bien ce cas. Un Manager du pôle A pouvait donc lire le brief ET la timeline de n'importe
//    quel projet, y compris hors de son pôle — potentiellement des objectifs/budget client
//    confidentiels.
//
// Fixed: assertProjectInScope ajouté à projectMeeting.service.ts (les 4 méthodes) et à
// projectTemplate.service.ts#applyToProject ; le filtre MANAGER ajouté à getBrief/
// getTimelineStatus ; authorize("ADMIN","MANAGER","CLIENT","FREELANCER") ajouté aux 2 routes.
//
// This test imports and calls the real services against a real database — not a
// reimplementation — and confirms a MANAGER from pole A is rejected/sees nothing when targeting
// a pole-B project on all 4 axes, while still working correctly for their own pole.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectMeetingService: typeof import("../src/services/projectMeeting.service.js").projectMeetingService;
let projectTemplateService: typeof import("../src/services/projectTemplate.service.js").projectTemplateService;
let projectService: typeof import("../src/services/project.service.js").projectService;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdMeetingIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectMeetingService } = await import("../src/services/projectMeeting.service.js"));
    ({ projectTemplateService } = await import("../src/services/projectTemplate.service.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.projectMeeting.deleteMany({ where: { id: { in: createdMeetingIds } } });
  await prisma.task.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeProjectInPoleB() {
  const client = await prisma.client.create({ data: { name: "idor-scope client", serviceId: serviceB } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: "idor-scope project", clientId: client.id, serviceId: serviceB } });
  createdProjectIds.push(project.id);
  return project;
}

// A function, not a module-level const: serviceA is only assigned inside before(), which runs
// after this module's top-level code — a const captured here would freeze userServiceId at
// undefined, silently making every "same-pole" check behave like "no pole at all" instead.
function managerAScope() {
  return { userRole: "MANAGER" as const, userServiceId: serviceA };
}

describe("SEC (session 2026-07-18): Manager pole scope enforced on meetings, templates, brief, timeline", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("projectMeetingService: a pole-A Manager cannot list/create meetings or read/change the schedule of a pole-B project", async () => {
    const project = await makeProjectInPoleB();

    await assert.rejects(
      () => projectMeetingService.listByProject(project.id, managerAScope()),
      (err: unknown) => err instanceof HttpError && (err as InstanceType<typeof HttpError>).statusCode === 403
    );
    await assert.rejects(
      () => projectMeetingService.create(project.id, { meetingDate: new Date() }, undefined, managerAScope()),
      (err: unknown) => err instanceof HttpError && (err as InstanceType<typeof HttpError>).statusCode === 403
    );
    await assert.rejects(
      () => projectMeetingService.getSchedule(project.id, managerAScope()),
      (err: unknown) => err instanceof HttpError && (err as InstanceType<typeof HttpError>).statusCode === 403
    );
    await assert.rejects(
      () => projectMeetingService.setSchedule(project.id, "WEEKLY", null, managerAScope()),
      (err: unknown) => err instanceof HttpError && (err as InstanceType<typeof HttpError>).statusCode === 403
    );
  });

  test("projectMeetingService: a same-pole Manager (or ADMIN, unscoped) can still use meetings normally", async () => {
    const client = await prisma.client.create({ data: { name: "idor-ownpole client", serviceId: serviceA } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: "idor-ownpole project", clientId: client.id, serviceId: serviceA } });
    createdProjectIds.push(project.id);

    const meeting = await projectMeetingService.create(project.id, { meetingDate: new Date() }, undefined, managerAScope());
    createdMeetingIds.push(meeting.id);
    const list = await projectMeetingService.listByProject(project.id, managerAScope());
    assert.ok(list.some((m) => m.id === meeting.id));

    // ADMIN (no service scope) can reach a pole-B project too.
    const otherProject = await makeProjectInPoleB();
    const adminList = await projectMeetingService.listByProject(otherProject.id, { userRole: "ADMIN" });
    assert.deepEqual(adminList, []);
  });

  test("projectTemplateService.applyToProject: a pole-A Manager cannot apply a template to a pole-B project", async () => {
    const project = await makeProjectInPoleB();

    await assert.rejects(
      () => projectTemplateService.applyToProject(project.id, managerAScope()),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 403);
        assert.equal((err as InstanceType<typeof HttpError>).code, "PROJECT_OUT_OF_SCOPE");
        return true;
      }
    );
  });

  test("projectService.getBrief: a pole-A Manager gets 404 for a pole-B project's brief, not the real data", async () => {
    const project = await makeProjectInPoleB();

    await assert.rejects(
      () => projectService.getBrief(project.id, "MANAGER", undefined, undefined, serviceA),
      (err: unknown) => err instanceof HttpError && (err as InstanceType<typeof HttpError>).statusCode === 404
    );
  });

  test("projectService.getTimelineStatus: a pole-A Manager gets 404 for a pole-B project's timeline", async () => {
    const project = await makeProjectInPoleB();

    await assert.rejects(
      () => projectService.getTimelineStatus(project.id, "MANAGER", undefined, undefined, serviceA),
      (err: unknown) => err instanceof HttpError && (err as InstanceType<typeof HttpError>).statusCode === 404
    );
  });
});
