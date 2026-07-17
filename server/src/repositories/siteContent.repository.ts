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

  // Bilingual list fields (type JSON) are stored once under locale "all" —
  // their value already contains both languages ({fr, en} per item) — so
  // they're independent of whatever locale the caller is asking for.
  async findAllLocaleRows(): Promise<SiteContentRow[]> {
    return prisma.siteContent.findMany({
      where: { locale: "all" },
      orderBy: [{ section: "asc" }, { key: "asc" }],
    });
  },

  async findGroupedByLocale(locale: string): Promise<Record<string, SiteContentRow[]>> {
    const rows = await prisma.siteContent.findMany({
      where: { OR: [{ locale }, { locale: "all" }] },
      orderBy: [{ section: "asc" }, { key: "asc" }],
    });
    const grouped: Record<string, SiteContentRow[]> = {};
    for (const row of rows) {
      if (!grouped[row.section]) grouped[row.section] = [];
      grouped[row.section].push(row);
    }
    return grouped;
  },

  async findByKeyAnyLocale(key: string): Promise<SiteContentRow | null> {
    return prisma.siteContent.findFirst({ where: { key } });
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

};
