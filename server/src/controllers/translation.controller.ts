import type { RequestHandler } from "express";
import { translationService } from "../services/translation.service.js";

export const translateFrToEn: RequestHandler = async (req, res, next) => {
  try {
    const translatedText = await translationService.translateFrToEn(req.body.text);
    res.json({ data: { translatedText } });
  } catch (error) {
    next(error);
  }
};
