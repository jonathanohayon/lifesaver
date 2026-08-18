import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  MEMORY_SCHEMA_HEALTH_MODE,
  buildMemorySchemaExampleInputs,
  buildMemorySchemaReport,
  buildMemorySchemaStatus,
  previewMemorySchema,
} from './memory-schema.model.js';

export function getMemorySchemaStatus(_req: Request, res: Response) {
  return res.json(ok(buildMemorySchemaStatus()));
}

export function getMemorySchemaReport(_req: Request, res: Response) {
  return res.json(ok(buildMemorySchemaReport()));
}

export function getMemorySchemaSchema(_req: Request, res: Response) {
  const report = buildMemorySchemaReport();
  return res.json(ok({
    phase: 'phase_15_4_memory_table',
    healthMode: MEMORY_SCHEMA_HEALTH_MODE,
    tableName: report.tableName,
    migrationFile: report.migrationFile,
    columns: report.columns,
    memoryTypes: report.memoryTypes,
    indexes: report.indexes,
    safety: report.safety,
  }));
}

export function getMemorySchemaExample(_req: Request, res: Response) {
  const exampleInputs = buildMemorySchemaExampleInputs();
  return res.json(ok({
    phase: 'phase_15_4_memory_table',
    healthMode: MEMORY_SCHEMA_HEALTH_MODE,
    exampleInputs,
    examplePreviews: Object.fromEntries(Object.entries(exampleInputs).map(([key, input]) => [key, previewMemorySchema(input)])),
  }));
}

export function previewMemorySchemaController(req: Request, res: Response) {
  return res.json(ok(previewMemorySchema(req.body)));
}
