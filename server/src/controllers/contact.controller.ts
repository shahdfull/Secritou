import type { RequestHandler } from "express";
import { ContactService } from "../services/contact.service.js";
import type { ContactStatus } from "@prisma/client";

const contactService = new ContactService();

export const submitContactRequest: RequestHandler = async (req, res, next) => {
  try {
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
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
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
    const companyId = req.user?.companyId!;
    const contactRequestId = req.params.id as string;
    const { assignedManagerId, department } = req.body;

    const lead = await contactService.convertToLead(
      contactRequestId,
      companyId,
      assignedManagerId,
      department
    );
    res.status(201).json({ data: lead });
  } catch (error) {
    next(error);
  }
};
