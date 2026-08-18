import { Router } from 'express';
import {
  connectTripleWhaleController,
  disconnectTripleWhaleController,
  getTripleWhaleStatusController,
} from './connected-accounts.controller.js';

export const tripleWhaleConnectionRouter = Router();

tripleWhaleConnectionRouter.get('/status', getTripleWhaleStatusController);
tripleWhaleConnectionRouter.post('/', connectTripleWhaleController);
tripleWhaleConnectionRouter.delete('/', disconnectTripleWhaleController);
