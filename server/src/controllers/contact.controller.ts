import type { RequestHandler } from "express";
import { ContactService } from "../services/contact.service.js";
import type { ContactStatus } from "@prisma/client";
import logger from "../utils/logger.js";
import { buildServiceScope } from "../utils/serviceScope.js";

const contactService = new ContactService();

export const submitContactRequest: RequestHandler = async (req, res, next) => {
  try {
    // Honeypot: a hidden field real visitors never fill. If a bot fills it,
    // pretend success (no DB write, no email) instead of a 400 that would
    // reveal the trap.
    if (req.body.website) {
      logger.info({ ip: req.ip }, "Contact form honeypot triggered");
      res.status(200).json({
        success: true,
        message: "Message sent successfully",
      });
      return;
    }

    await contactService.sendContactMessage(req.body);
    res.status(200).json({
      success: true,
      message: "Message sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getContactRequests: RequestHandler = async (req, res, next) => {
  try {
    const status = req.query.status as ContactStatus | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    // SEC-181: pageSize is the dominant convention across the rest of the API (parseListQuery);
    // limit is still accepted for backward compatibility, but a caller using the dominant
    // convention must not have it silently ignored.
    const limitParam = req.query.pageSize ?? req.query.limit;
    const limit = limitParam ? parseInt(limitParam as string, 10) : 20;
    const result = await contactService.getContactRequests(status, page, limit);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateContactRequest: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body as { status: ContactStatus };
    const result = await contactService.updateContactRequestStatus(id, status);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const convertToLead: RequestHandler = async (req, res, next) => {
  try {
    const contactRequestId = req.params.id as string;
    const { assignedManagerId, department } = req.body;

    const lead = await contactService.convertToLead(
      contactRequestId,
      assignedManagerId,
      department,
      await buildServiceScope(req)
    );
    res.status(201).json({ data: lead });
  } catch (error) {
    next(error);
  }
};
