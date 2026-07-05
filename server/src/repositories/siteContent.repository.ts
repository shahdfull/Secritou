import { prisma } from "../config/prisma.js";
import type { SiteContentSection, SiteContentType } from "@prisma/client";

export type SiteContentRow = {
  id: string;
  key: string;
  locale: string;
  value: string;
  type: SiteContentType;
  section: SiteContentSection;
  label: string;
  updatedAt: Date;
};

export type SiteContentUpsert = {
  key: string;
  locale: string;
  value: string;
  type?: SiteContentType;
  section: SiteContentSection;
  label: string;
};

export const siteContentRepository = {
  async findByLocale(locale: string): Promise<SiteContentRow[]> {
    return prisma.siteContent.findMany({
      where: { locale },
      orderBy: [{ section: "asc" }, { key: "asc" }],
    });
  },

  async findGroupedByLocale(locale: string): Promise<Record<string, SiteContentRow[]>> {
    const rows = await prisma.siteContent.findMany({
      where: { locale },
      orderBy: [{ section: "asc" }, { key: "asc" }],
    });
    const grouped: Record<string, SiteContentRow[]> = {};
    for (const row of rows) {
      if (!grouped[row.section]) grouped[row.section] = [];
      grouped[row.section].push(row);
    }
    return grouped;
  },

  async upsertOne(item: SiteContentUpsert): Promise<SiteContentRow> {
    return prisma.siteContent.upsert({
      where: { key_locale: { key: item.key, locale: item.locale } },
      update: { value: item.value },
      create: {
        key: item.key,
        locale: item.locale,
        value: item.value,
        type: item.type ?? "TEXT",
        section: item.section,
        label: item.label,
      },
    });
  },

  async upsertMany(items: SiteContentUpsert[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.siteContent.upsert({
          where: { key_locale: { key: item.key, locale: item.locale } },
          update: { value: item.value, type: item.type ?? "TEXT", label: item.label },
          create: {
            key: item.key,
            locale: item.locale,
            value: item.value,
            type: item.type ?? "TEXT",
            section: item.section,
            label: item.label,
          },
        })
      )
    );
  },
};
