import { prismaRead } from "../config/prisma.js";

export const projectTemplateRepository = {
  async findByServiceId(serviceId: string) {
    return prismaRead.projectTemplate.findUnique({
      where: { serviceId },
      include: { tasks: { orderBy: { orderIndex: "asc" } } },
    });
  },
};
