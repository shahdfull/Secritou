import type { Request, Response } from "express";
import { gscConnectionService, parseState } from "../services/gscConnection.service.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export const startGscConnect = async (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  const { url } = await gscConnectionService.startConnect(clientId, req.user!.id);
  res.json({ data: { url } });
};

// Google redirects here directly (no auth header) — the signed `state` param is the
// only thing tying this request back to an authenticated admin/manager action.
export const handleGscCallback = async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state) {
    return res.redirect(`${env.FRONTEND_URL}/app/clients?gscError=missing_code_or_state`);
  }

  let clientId: string | undefined;
  try {
    ({ clientId } = parseState(state));
    const redirectBase = `${env.FRONTEND_URL}/app/clients/${clientId}`;
    const { pendingId, sites } = await gscConnectionService.listAvailableSites(clientId, code);
    const params = new URLSearchParams({
      gscPendingId: pendingId,
      gscClientId: clientId,
      gscSites: JSON.stringify(sites.map((s) => s.siteUrl)),
    });
    res.redirect(`${redirectBase}?${params.toString()}`);
  } catch (err) {
    const message = err instanceof HttpError ? err.message : "connection_failed";
    const redirectBase = clientId ? `${env.FRONTEND_URL}/app/clients/${clientId}` : `${env.FRONTEND_URL}/app/clients`;
    res.redirect(`${redirectBase}?gscError=${encodeURIComponent(message)}`);
  }
};

export const completeGscConnect = async (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  const { pendingId, siteUrl } = req.body as { pendingId: string; siteUrl: string };
  const connection = await gscConnectionService.completeConnect(clientId, req.user!.id, pendingId, siteUrl);
  res.status(200).json({ data: { siteUrl: connection.siteUrl, connectedAt: connection.createdAt } });
};

export const getGscStatus = async (req: Request, res: Response) => {
  const status = await gscConnectionService.getStatus(req.params.clientId as string);
  res.json({ data: status });
};

export const disconnectGsc = async (req: Request, res: Response) => {
  await gscConnectionService.disconnect(req.params.clientId as string);
  res.status(204).send();
};
