import { prisma } from "../config/prisma.js";
import { businessMonthKey, fillMonthGaps, startOfBusinessMonth } from "../utils/dateRange.js";
import type { AnalyticsEventInput } from "../validators/analyticsEvent.validator.js";

export const analyticsEventService = {
  async recordEvent(input: AnalyticsEventInput) {
    return prisma.analyticsEvent.create({
      data: {
        name: input.name,
        properties: input.properties ?? undefined,
        pagePath: input.pagePath,
        pageUrl: input.pageUrl,
        referrer: input.referrer,
        sessionId: input.sessionId,
      },
    });
  },

  async getEventSummary(from?: Date, to?: Date) {
    const rangeFrom = from ?? startOfBusinessMonth(new Date(new Date().setMonth(new Date().getMonth() - 11)));
    const rangeTo = to ?? new Date();
    const where = { createdAt: { gte: rangeFrom, lte: rangeTo } };

    const [total, byNameRaw, rows] = await Promise.all([
      prisma.analyticsEvent.count({ where }),
      prisma.analyticsEvent.groupBy({ by: ["name"], where, _count: { name: true }, orderBy: { _count: { name: "desc" } } }),
      prisma.analyticsEvent.findMany({ where, select: { name: true, createdAt: true } }),
    ]);

    const byName = byNameRaw.map((item) => ({ name: item.name, count: item._count.name }));

    const byMonth = new Map<string, number>();
    for (const row of rows) {
      const key = businessMonthKey(row.createdAt);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    const eventsByMonth = fillMonthGaps(byMonth, rangeFrom, rangeTo, 0).map(({ month, value }) => ({ month, count: value }));

    return { total, byName, eventsByMonth };
  },

  async getTopPages(from?: Date, to?: Date, limit = 10) {
    const rangeFrom = from ?? startOfBusinessMonth(new Date(new Date().setMonth(new Date().getMonth() - 11)));
    const rangeTo = to ?? new Date();

    const byPageRaw = await prisma.analyticsEvent.groupBy({
      by: ["pagePath"],
      where: { createdAt: { gte: rangeFrom, lte: rangeTo }, pagePath: { not: null } },
      _count: { pagePath: true },
      orderBy: { _count: { pagePath: "desc" } },
      take: limit,
    });

    return byPageRaw.map((item) => ({ pagePath: item.pagePath as string, count: item._count.pagePath }));
  },

  async getFunnels(from?: Date, to?: Date) {
    const rangeFrom = from ?? startOfBusinessMonth(new Date(new Date().setMonth(new Date().getMonth() - 11)));
    const rangeTo = to ?? new Date();
    const where = { createdAt: { gte: rangeFrom, lte: rangeTo } };

    const [ctaClicked, contactFormSubmitted, contactFormFailed] = await Promise.all([
      prisma.analyticsEvent.count({ where: { ...where, name: "cta_clicked" } }),
      prisma.analyticsEvent.count({ where: { ...where, name: "contact_form_submitted" } }),
      prisma.analyticsEvent.count({ where: { ...where, name: "contact_form_failed" } }),
    ]);

    const conversionRate = ctaClicked > 0 ? Math.round((contactFormSubmitted / ctaClicked) * 100) : 0;

    return {
      ctaToContact: {
        ctaClicked,
        contactFormSubmitted,
        contactFormFailed,
        conversionRate,
      },
    };
  },

  async pruneOldEvents(olderThanMonths = 13) {
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - olderThanMonths);
    const result = await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  },
};
