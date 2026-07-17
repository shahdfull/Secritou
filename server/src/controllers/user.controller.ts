import type { RequestHandler } from "express";
import { userService, permissionsMatrix } from "../services/user.service.js";
import { HttpError } from "../utils/httpError.js";
import { parseListQuery } from "../utils/listQuery.js";

// GET /users/me : any authenticated role
export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user!.sub);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

// PATCH /users/me : any authenticated role. Email is intentionally ignored here — see
// requestEmailChange, which requires confirmation via a link sent to the new address.
export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    const { name, phone } = req.body as { name?: string; phone?: string | null };
    const user = await userService.updateMe(req.user!.sub, { name, phone });
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

// POST /users/me/email-change : any authenticated role — stages the new email and sends a
// confirmation link to it; the change only takes effect once that link is visited.
export const requestEmailChange: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body as { email: string };
    await userService.requestEmailChange(req.user!.sub, email);
    res.status(202).json({ data: { message: "Confirmation email sent" } });
  } catch (error) {
    next(error);
  }
};

// POST /users/me/email-change/confirm : public (the token itself is the credential, like
// password reset) — applies a previously-requested email change.
export const confirmEmailChange: RequestHandler = async (req, res, next) => {
  try {
    const { token } = req.body as { token: string };
    const user = await userService.confirmEmailChange(token);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const getUsers: RequestHandler = async (req, res, next) => {
  try {
    const options = parseListQuery(req.query as Record<string, unknown>);
    const result = await userService.getUsersByCompany(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const inviteUser: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    const user = await userService.inviteUser(email, name, role);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role } = req.body;
    const user = await userService.updateUser(id as string, name, role, {
      id: req.user?.sub,
      role: req.user?.role,
      ip: req.ip,
    });
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actor = { id: req.user?.sub, role: req.user?.role, ip: req.ip };
    await userService.deleteUser(id as string, actor);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getPermissions: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: permissionsMatrix });
  } catch (error) {
    next(error);
  }
};

// POST /users/me/heartbeat : any authenticated role — pinged periodically by the
// front-end while the back-office tab is open and visible, to track connected time.
export const heartbeat: RequestHandler = async (req, res, next) => {
  try {
    await userService.recordHeartbeat(req.user!.sub);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
