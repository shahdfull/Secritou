import { Prisma } from "@prisma/client";
import { prismaQueriesTotal, prismaQueryDuration } from "./metrics.js";

export const prismaMetricsExtension = Prisma.defineExtension({
  name: "observability",
  query: {
    async $allOperations({ model, operation, args, query }) {
      const start = performance.now();
      const modelName = model ?? "raw";

      try {
        const result = await query(args);
        const durationSec = (performance.now() - start) / 1000;

        prismaQueryDuration.observe({ model: modelName, operation }, durationSec);
        prismaQueriesTotal.inc({ model: modelName, operation, status: "success" });

        return result;
      } catch (error) {
        const durationSec = (performance.now() - start) / 1000;
        prismaQueryDuration.observe({ model: modelName, operation }, durationSec);
        prismaQueriesTotal.inc({ model: modelName, operation, status: "error" });
        throw error;
      }
    },
  },
});
