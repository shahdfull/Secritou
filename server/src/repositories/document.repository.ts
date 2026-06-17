import { prismaRead as prisma } from '../config/prisma.js';
import type { DocumentType } from '@prisma/client';
import type { ListQueryOptions, PaginatedResult } from '../utils/listQuery.js';
import { buildOrderBy } from '../utils/listQuery.js';

const SORTABLE_FIELDS = ['name', 'type', 'createdAt'];

export const documentRepository = {
  async findByClientId(
    clientId: string,
    companyId: string,
    options: ListQueryOptions
  ): Promise<PaginatedResult<unknown>> {
    const where = { clientId, companyId };
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, 'createdAt');

    const [data, total] = await Promise.all([
      prisma.document.findMany({ where, orderBy, skip, take: options.pageSize }),
      prisma.document.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async findByCompanyId(
    companyId: string,
    options: ListQueryOptions
  ): Promise<PaginatedResult<unknown>> {
    const where = { companyId };
    const skip = (options.page - 1) * options.pageSize;
    const orderBy = buildOrderBy(options.orderBy, options.orderDir, SORTABLE_FIELDS, 'createdAt');

    const [data, total] = await Promise.all([
      prisma.document.findMany({ where, orderBy, skip, take: options.pageSize }),
      prisma.document.count({ where }),
    ]);

    return { data, total, page: options.page, pageSize: options.pageSize };
  },

  async create(data: {
    name: string;
    type: DocumentType;
    url: string;
    companyId: string;
    projectId?: string;
    clientId?: string;
  }) {
    return prisma.document.create({ data });
  },
};
