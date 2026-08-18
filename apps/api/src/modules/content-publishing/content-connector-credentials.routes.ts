import { Router } from 'express';
import {
  disconnectLinkedInConnectorController,
  getLinkedInConnectorStatusController,
} from './content-connector-credentials.controller.js';

export const linkedinConnectorRouter = Router();

linkedinConnectorRouter.get('/status', getLinkedInConnectorStatusController);
linkedinConnectorRouter.delete('/', disconnectLinkedInConnectorController);
