import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { ActionStatus, ActionType } from '../actions/actions.types.js';
import type { SandboxLifecycleResult, SandboxLifecycleResultStoragePreview } from './executor.sandbox-lifecycle.js';

export const EXECUTION_RESULT_LOGS_PHASE = 'v0.6.0 Phase 8.7 Execution Result Logs' as const;

export type ActionResultLogStatus = 'pending' | 'success' | 'failed' | 'blocked' | 'skipped' | 'rollback_success' | 'rollback_failed';

export type SandboxExecutionResultLogRecord = {
  action_id: string;
  workspace_id: string;
  executor_name: string;
  external_id: string | null;
  external_url: string | null;
  result_status: ActionResultLogStatus;
  result_summary: string | null;
  error_message: string | null;
  rollback_supported: boolean;
  rollback_payload: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
};

export type PersistSandboxExecutionResultLogOptions = {
  /**
   * Keep false for tests, UI previews, and local safety checks.
   * Use true only inside an approved backend flow after the action row exists.
   */
  persist?: boolean;
};

export type PersistSandboxExecutionResultLogResult = {
  version: '0.6.0';
  phase: typeof EXECUTION_RESULT_LOGS_PHASE;
  targetTable: 'action_results';
  stored: boolean;
  databaseConfigured: boolean;
  skippedReason: string | null;
  actionId: string;
  workspaceId: string;
  recordPreview: SandboxExecutionResultLogRecord;
  safety: {
    sandboxOnly: true;
    externalWritesAttempted: false;
    externalWritesSucceeded: false;
    exposesRollbackPayloadToBrowser: false;
    note: string;
  };
};

type InsertedActionResultRow = {
  id: string;
  action_id: string;
  workspace_id: string;
  executor_name: string;
  result_status: ActionResultLogStatus;
  created_at: Date;
};

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function lifecycleErrorMessage(result: SandboxLifecycleResult): string | null {
  if (result.lifecycle.executed) return null;
  const latestError = [...result.lifecycle.events].reverse().find((event) => event.eventType === 'execution_failed' || event.eventType === 'execution_blocked');
  if (latestError?.message) return latestError.message.slice(0, 1000);
  if (result.executor.validationErrors.length > 0) return result.executor.validationErrors.join(' ').slice(0, 1000);
  if (result.lifecycle.blocked) return 'Sandbox lifecycle blocked execution before external writes were attempted.';
  if (result.lifecycle.failed) return 'Sandbox lifecycle failed before external writes were attempted.';
  return null;
}

function fallbackResultStatus(result: SandboxLifecycleResult): 'success' | 'failed' | 'blocked' | 'skipped' {
  if (result.lifecycle.executed) return 'success';
  if (result.lifecycle.blocked) return 'blocked';
  if (result.lifecycle.failed) return 'failed';
  return 'skipped';
}

function fallbackExecutorName(result: SandboxLifecycleResult): string {
  if (result.executor.name) return result.executor.name;
  if (result.lifecycle.blocked) return 'sandboxLifecycleGuard';
  return 'sandboxLifecycleUnknownExecutor';
}

function fallbackResultSummary(result: SandboxLifecycleResult): string {
  if (result.executor.resultStoragePreview?.result_summary) return result.executor.resultStoragePreview.result_summary;
  const latest = [...result.lifecycle.events].reverse().find((event) => event.message);
  return latest?.message || 'Sandbox lifecycle result recorded for audit visibility.';
}

function normalizePreview(result: SandboxLifecycleResult): SandboxLifecycleResultStoragePreview {
  const preview = result.executor.resultStoragePreview;
  if (preview) return preview;
  return {
    executor_name: fallbackExecutorName(result),
    result_status: fallbackResultStatus(result),
    external_id: null,
    external_url: null,
    result_summary: fallbackResultSummary(result),
    rollback_supported: false,
    rollback_payload: {},
    metadata_json: {
      fallback_preview: true,
      sandbox_only: true,
      external_writes_attempted: false,
      external_writes_succeeded: false,
    },
  };
}

export function buildSandboxExecutionResultLogRecord(result: SandboxLifecycleResult): SandboxExecutionResultLogRecord {
  const preview = normalizePreview(result);
  const resultStatus = preview.result_status as ActionResultLogStatus;
  const errorMessage = ['failed', 'blocked', 'skipped', 'rollback_failed'].includes(resultStatus)
    ? lifecycleErrorMessage(result)
    : null;

  return {
    action_id: result.actionId,
    workspace_id: result.workspaceId,
    executor_name: preview.executor_name,
    external_id: preview.external_id,
    external_url: preview.external_url,
    result_status: resultStatus,
    result_summary: preview.result_summary,
    error_message: errorMessage,
    rollback_supported: Boolean(preview.rollback_supported),
    rollback_payload: safeObject(preview.rollback_payload),
    metadata_json: {
      phase: EXECUTION_RESULT_LOGS_PHASE,
      source_lifecycle_phase: result.phase,
      action_type: result.actionType,
      lifecycle_status_path: result.lifecycle.statusPath,
      lifecycle_final_status: result.lifecycle.finalStatus,
      lifecycle_events: result.lifecycle.events.map((event) => ({
        eventType: event.eventType,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        message: event.message,
        createdAt: event.createdAt,
      })),
      executor_found: result.executor.found,
      executor_mode: result.executor.mode,
      validation_ok: result.executor.validationOk,
      validation_reason: result.executor.validationReason,
      validation_warnings: result.executor.validationWarnings,
      validation_errors: result.executor.validationErrors,
      sandbox_only: true,
      external_writes_attempted: false,
      external_writes_succeeded: false,
      real_executor_enabled: false,
      auto_run_enabled: false,
      result_metadata: safeObject(preview.metadata_json),
    },
  };
}

export async function persistSandboxExecutionResultLog(
  lifecycleResult: SandboxLifecycleResult,
  options: PersistSandboxExecutionResultLogOptions = {}
): Promise<PersistSandboxExecutionResultLogResult> {
  const recordPreview = buildSandboxExecutionResultLogRecord(lifecycleResult);
  const persist = options.persist === true;

  if (!persist) {
    return {
      version: '0.6.0',
      phase: EXECUTION_RESULT_LOGS_PHASE,
      targetTable: 'action_results',
      stored: false,
      databaseConfigured: isDatabaseConfigured,
      skippedReason: 'persistence_not_requested',
      actionId: lifecycleResult.actionId,
      workspaceId: lifecycleResult.workspaceId,
      recordPreview,
      safety: {
        sandboxOnly: true,
        externalWritesAttempted: false,
        externalWritesSucceeded: false,
        exposesRollbackPayloadToBrowser: false,
        note: 'Phase 8.7 can persist sandbox executor results to action_results when explicitly called by an approved backend flow. This preview call did not write to the database.',
      },
    };
  }

  if (!isDatabaseConfigured) {
    return {
      version: '0.6.0',
      phase: EXECUTION_RESULT_LOGS_PHASE,
      targetTable: 'action_results',
      stored: false,
      databaseConfigured: false,
      skippedReason: 'database_not_configured',
      actionId: lifecycleResult.actionId,
      workspaceId: lifecycleResult.workspaceId,
      recordPreview,
      safety: {
        sandboxOnly: true,
        externalWritesAttempted: false,
        externalWritesSucceeded: false,
        exposesRollbackPayloadToBrowser: false,
        note: 'DATABASE_URL is not configured. No action_results row was inserted and no external write was attempted.',
      },
    };
  }

  await query<InsertedActionResultRow>(
    `INSERT INTO action_results (
       action_id,
       workspace_id,
       executor_name,
       external_id,
       external_url,
       result_status,
       result_summary,
       error_message,
       rollback_supported,
       rollback_payload,
       metadata_json
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
     RETURNING id, action_id, workspace_id, executor_name, result_status, created_at;`,
    [
      recordPreview.action_id,
      recordPreview.workspace_id,
      recordPreview.executor_name,
      recordPreview.external_id,
      recordPreview.external_url,
      recordPreview.result_status,
      recordPreview.result_summary,
      recordPreview.error_message,
      recordPreview.rollback_supported,
      JSON.stringify(recordPreview.rollback_payload || {}),
      JSON.stringify(recordPreview.metadata_json || {}),
    ]
  );

  return {
    version: '0.6.0',
    phase: EXECUTION_RESULT_LOGS_PHASE,
    targetTable: 'action_results',
    stored: true,
    databaseConfigured: true,
    skippedReason: null,
    actionId: lifecycleResult.actionId,
    workspaceId: lifecycleResult.workspaceId,
    recordPreview,
    safety: {
      sandboxOnly: true,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      exposesRollbackPayloadToBrowser: false,
      note: 'Sandbox executor result was stored in action_results. The row contains fake sandbox result data only and does not prove a real external platform was touched.',
    },
  };
}

export function buildExecutionResultLogsSafetySummary(): {
  version: '0.6.0';
  phase: typeof EXECUTION_RESULT_LOGS_PHASE;
  storesInActionResults: true;
  visibleThroughActionDetailResultSummary: true;
  browserReceivesRollbackPayload: false;
  sandboxOnly: true;
  externalWritesEnabled: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: EXECUTION_RESULT_LOGS_PHASE,
    storesInActionResults: true,
    visibleThroughActionDetailResultSummary: true,
    browserReceivesRollbackPayload: false,
    sandboxOnly: true,
    externalWritesEnabled: false,
    note: 'Phase 8.7 maps sandbox lifecycle outcomes into action_results and exposes safe result summaries through the existing action detail UI. Rollback payloads remain hidden from the browser.',
  };
}

export function summarizeResultLogDecision(record: SandboxExecutionResultLogRecord): string {
  const status = record.result_status.replace(/_/g, ' ');
  const executor = record.executor_name || 'sandbox executor';
  const external = record.external_id ? ` Fake external id: ${record.external_id}.` : '';
  return `${executor} recorded ${status} in action_results.${external}`;
}
