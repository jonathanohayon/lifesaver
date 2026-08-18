import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getLatestTripleWhaleMappingPreview, getLatestTripleWhaleRawResponse, getTripleWhaleSnapshotHistory, probeTripleWhaleAttribution, probeTripleWhaleSummary, refreshTripleWhaleMetrics, testTripleWhaleConnection } from './triple-whale.service.js';

export async function refreshTripleWhaleMetricsController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await refreshTripleWhaleMetrics(auth.workspaceId, auth.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function testTripleWhaleConnectionController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await testTripleWhaleConnection(auth.workspaceId, auth.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}


export async function probeTripleWhaleSummaryController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await probeTripleWhaleSummary(auth.workspaceId, auth.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}


export async function probeTripleWhaleAttributionController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await probeTripleWhaleAttribution(auth.workspaceId, auth.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function latestTripleWhaleRawResponseController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const kind = typeof req.query.kind === 'string' ? req.query.kind : 'summary_probe';
    const result = await getLatestTripleWhaleRawResponse(auth.workspaceId, kind);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}


export async function mappingPreviewController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await getLatestTripleWhaleMappingPreview(auth.workspaceId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function snapshotHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await getTripleWhaleSnapshotHistory(auth.workspaceId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
