import { Router } from 'express';
import { getProductSurfaces } from './product-surfaces.controller.js';

export const productSurfacesRouter = Router();

productSurfacesRouter.get('/', getProductSurfaces);
