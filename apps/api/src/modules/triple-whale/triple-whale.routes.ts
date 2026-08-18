import { Router } from 'express';
import {
  latestTripleWhaleRawResponseController,
  mappingPreviewController,
  snapshotHistoryController,
  probeTripleWhaleSummaryController,
  probeTripleWhaleAttributionController,
  refreshTripleWhaleMetricsController,
  testTripleWhaleConnectionController,
} from './triple-whale.controller.js';

export const tripleWhaleRouter = Router();
export const refreshMetricsRouter = Router();

tripleWhaleRouter.post('/refresh-metrics', refreshTripleWhaleMetricsController);
tripleWhaleRouter.post('/test-connection', testTripleWhaleConnectionController);
tripleWhaleRouter.post('/summary-probe', probeTripleWhaleSummaryController);
tripleWhaleRouter.post('/attribution-probe', probeTripleWhaleAttributionController);
tripleWhaleRouter.get('/latest-raw-response', latestTripleWhaleRawResponseController);
tripleWhaleRouter.get('/mapping-preview', mappingPreviewController);
tripleWhaleRouter.get('/snapshot-history', snapshotHistoryController);
refreshMetricsRouter.post('/', refreshTripleWhaleMetricsController);
