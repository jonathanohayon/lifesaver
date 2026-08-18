import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  MEMORY_UI_HEALTH_MODE,
  buildMemoryUiExampleItems,
  buildMemoryUiReport,
  buildMemoryUiStatus,
  previewMemoryUiOperation,
} from './memory-ui.model.js';

export function getMemoryUiStatus(_req: Request, res: Response) {
  return res.json(ok(buildMemoryUiStatus()));
}

export function getMemoryUiReport(_req: Request, res: Response) {
  return res.json(ok(buildMemoryUiReport()));
}

export function getMemoryUiExample(_req: Request, res: Response) {
  const items = buildMemoryUiExampleItems();
  return res.json(ok({
    phase: 'phase_15_5_memory_ui',
    healthMode: MEMORY_UI_HEALTH_MODE,
    exampleItems: items,
    exampleOperations: {
      view: previewMemoryUiOperation({ operation: 'view_memory', item: items[0] }),
      edit: previewMemoryUiOperation({ operation: 'edit_memory', item: items[0], patch: { title: 'Updated premium founder voice' } }),
      approve: previewMemoryUiOperation({ operation: 'approve_suggested_memory', item: items[1], actor_user_id: 'user_preview_owner' }),
      disable: previewMemoryUiOperation({ operation: 'disable_memory_item', item: items[0], reason: 'Founder paused this memory for review.' }),
      delete: previewMemoryUiOperation({ operation: 'delete_memory', item: items[2], reason: 'No longer applicable.' }),
    },
  }));
}

export function previewMemoryUiOperationController(req: Request, res: Response) {
  return res.json(ok(previewMemoryUiOperation(req.body)));
}
