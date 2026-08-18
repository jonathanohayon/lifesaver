import { Router } from 'express';
import { getOnboardingStatusController, refreshOnboardingStatusController } from './onboarding.controller.js';

export const onboardingRouter = Router();

onboardingRouter.get('/status', getOnboardingStatusController);
onboardingRouter.post('/refresh-status', refreshOnboardingStatusController);
