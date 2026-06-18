import type { RequestHandler } from "express";
import { ratingService } from "../services/rating.service.js";

export const createRating: RequestHandler = async (req, res, next) => {
  try {
    const reviewerId = req.user!.sub;
    const reviewerRole = req.user!.role;
    const companyId = req.user!.companyId;
    const rating = await ratingService.createRating(reviewerId, reviewerRole, companyId, req.body);
    res.status(201).json({ data: rating });
  } catch (error) {
    next(error);
  }
};

export const updateRating: RequestHandler = async (req, res, next) => {
  try {
    const reviewerId = req.user!.sub;
    const reviewerRole = req.user!.role;
    const rating = await ratingService.updateRating(req.params.id as string, reviewerId, reviewerRole, req.body);
    res.json({ data: rating });
  } catch (error) {
    next(error);
  }
};

export const deleteRating: RequestHandler = async (req, res, next) => {
  try {
    const reviewerId = req.user!.sub;
    const reviewerRole = req.user!.role;
    await ratingService.deleteRating(req.params.id as string, reviewerId, reviewerRole);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getFreelancerRatings: RequestHandler = async (req, res, next) => {
  try {
    const freelancerId = req.params.freelancerId as string;
    const page = Number(req.query.page) || 1;
    const pageSize = Math.min(Number(req.query.pageSize) || 10, 50);
    const result = await ratingService.getFreelancerRatings(freelancerId, page, pageSize);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getFreelancerRatingStats: RequestHandler = async (req, res, next) => {
  try {
    const stats = await ratingService.getRatingStats(req.params.freelancerId as string);
    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
};

export const getRatingById: RequestHandler = async (req, res, next) => {
  try {
    const rating = await ratingService.getRatingById(req.params.id as string);
    res.json({ data: rating });
  } catch (error) {
    next(error);
  }
};
