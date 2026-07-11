import { prisma, prismaRead } from "../config/prisma.js";

export const projectTemplateRepository = {
  async findByServiceId(serviceId: string) {
    return prismaRead.projectTemplate.findUnique({
      where: { serviceId },
      include: { tasks: { orderBy: { orderIndex: "asc" } } },
    });
  },

  async applyToProject(templateId: string, projectId: string) {
    const template = await prismaRead.projectTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: { orderBy: { orderIndex: "asc" } } },
    });
    if (!template) return [];
    if (template.tasks.length === 0) return [];

    await prisma.task.createMany({
      data: template.tasks.map((t) => ({
        title: t.title,
        description: t.description ?? undefined,
        projectId,
      })),
    });
    return prisma.task.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: template.tasks.length });
  },
};
