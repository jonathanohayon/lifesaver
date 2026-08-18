import { Router } from 'express';
import { loginController, logoutController, meController, signupController } from './auth.controller.js';
import { authRequired } from '../../common/middleware/auth-required.js';

export const authRouter = Router();

authRouter.post('/signup', signupController);
authRouter.post('/login', loginController);
authRouter.get('/me', authRequired, meController);
authRouter.post('/logout', authRequired, logoutController);
