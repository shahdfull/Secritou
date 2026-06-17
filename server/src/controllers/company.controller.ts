// Controller for Companies - HTTP request handlers
import type { RequestHandler } from "express";
import { companyService } from "../services/company.service.js";

export const getCompany: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const company = await companyService.getCompanyById(companyId);
    res.json({ data: company });
  } catch (error) {
    next(error);
  }
};

import { parseListQuery } from "../utils/listQuery.js";

export const getCompanyUsers: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await companyService.getCompanyUsers(companyId, options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateCompany: RequestHandler = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId!;
    const company = await companyService.updateCompany(companyId, req.body);
    res.json({ data: company });
  } catch (error) {
    next(error);
  }
};
