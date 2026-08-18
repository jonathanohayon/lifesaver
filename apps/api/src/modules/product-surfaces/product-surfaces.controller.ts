import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getProductSurfaceModel } from './product-surfaces.service.js';

export function getProductSurfaces(_req: Request, res: Response) {
  return res.json(ok(getProductSurfaceModel()));
}
