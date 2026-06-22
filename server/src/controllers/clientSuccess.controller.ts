import type { Request, Response } from "express";
import { clientSuccessService } from "../services/clientSuccess.service.js";

function paramText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Invalid route parameter");
  }
  return value;
}

export const getClientSuccess = async (req: Request, res: Response) => {
  const success = await clientSuccessService.getByClientId(paramText(req.params.clientId));
  res.json({ data: success });
};

export const updateClientSuccessScore = async (req: Request, res: Response) => {
  const success = await clientSuccessService.updateScore(
    paramText(req.params.clientId),
    req.body.score
  );
  res.json({ data: success });
};

export const calculateClientSuccessScore = async (req: Request, res: Response) => {
  const clientId = paramText(req.params.clientId);
  const score = await clientSuccessService.calculateScore(clientId);
  await clientSuccessService.updateScore(clientId, score);
  res.json({ data: { score } });
};

export const addSuccessObjective = async (req: Request, res: Response) => {
  const objective = await clientSuccessService.addObjective(
    paramText(req.params.clientId),
    req.body
  );
  res.json({ data: objective });
};

export const updateSuccessObjective = async (req: Request, res: Response) => {
  const objective = await clientSuccessService.updateObjective(
    paramText(req.params.objectiveId),
    req.body
  );
  res.json({ data: objective });
};

export const deleteSuccessObjective = async (req: Request, res: Response) => {
  await clientSuccessService.deleteObjective(paramText(req.params.objectiveId));
  res.json({ data: { success: true } });
};

export const addSuccessMetric = async (req: Request, res: Response) => {
  const metric = await clientSuccessService.addMetric(
    paramText(req.params.clientId),
    req.body
  );
  res.json({ data: metric });
};

export const updateSuccessMetric = async (req: Request, res: Response) => {
  const metric = await clientSuccessService.updateMetric(
    paramText(req.params.metricId),
    req.body
  );
  res.json({ data: metric });
};

export const deleteSuccessMetric = async (req: Request, res: Response) => {
  await clientSuccessService.deleteMetric(paramText(req.params.metricId));
  res.json({ data: { success: true } });
};

export const addSuccessRecommendation = async (req: Request, res: Response) => {
  const recommendation = await clientSuccessService.addRecommendation(
    paramText(req.params.clientId),
    req.body
  );
  res.json({ data: recommendation });
};

export const updateSuccessRecommendation = async (req: Request, res: Response) => {
  const recommendation = await clientSuccessService.updateRecommendation(
    paramText(req.params.recommendationId),
    req.body
  );
  res.json({ data: recommendation });
};

export const deleteSuccessRecommendation = async (req: Request, res: Response) => {
  await clientSuccessService.deleteRecommendation(paramText(req.params.recommendationId));
  res.json({ data: { success: true } });
};

export const addSuccessTimeline = async (req: Request, res: Response) => {
  const timeline = await clientSuccessService.addTimeline(
    paramText(req.params.clientId),
    req.body
  );
  res.json({ data: timeline });
};

export const deleteSuccessTimeline = async (req: Request, res: Response) => {
  await clientSuccessService.deleteTimeline(paramText(req.params.timelineId));
  res.json({ data: { success: true } });
};
