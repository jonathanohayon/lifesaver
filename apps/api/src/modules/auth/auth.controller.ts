import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getMeFromToken, loginFounder, signupCustomer } from './auth.service.js';



export async function signupController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await signupCustomer(req.body);
    res.status(201).json(ok(result));
  } catch (error) {
    next(error);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await loginFounder(req.body);
    res.json(ok(result));
  } catch (error) {
    next(error);
  }
}

export async function meController(req: Request, res: Response) {
  const payload = (req as any).auth;
  res.json(ok(getMeFromToken(payload)));
}

export async function logoutController(_req: Request, res: Response) {
  // Stateless token logout: frontend simply deletes the token.
  res.json(ok({ loggedOut: true, message: 'Local session cleared by the client.' }));
}
