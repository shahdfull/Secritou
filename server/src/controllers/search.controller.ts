import type { RequestHandler } from "express";
import { searchService } from "../services/search.service.js";
import { userRepository } from "../repositories/user.repository.js";
import type { SearchActor } from "../repositories/search.repository.js";

export const globalSearch: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user!;
    // A MANAGER's results are scoped to their service (pole), resolved from the DB.
    const serviceId = user.role === "MANAGER" ? await userRepository.findServiceId(user.id) : null;
    const actor: SearchActor = {
      role: user.role,
      companyId: user.companyId,
      clientId: user.clientId,
      userId: user.id,
      serviceId,
    };
    const q = (req.query.q as string) || "";
    const results = await searchService.search(actor, q);
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
};
