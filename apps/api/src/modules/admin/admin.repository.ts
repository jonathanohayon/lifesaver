import { isDatabaseConfigured, query } from '../../db/pool.js';

export type AdminDbCounts = {
  users: number;
  workspaces: number;
  workspaceMembers: number;
  connectedAccounts: number;
  metricsSnapshots: number;
  chatMessages: number;
  briefs: number;
  drafts: number;
  usageLogs: number;
  systemEvents: number;
};

export type AdminDefaultWorkspace = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  planKey: string;
  ownerEmail: string | null;
  createdAt: string;
} | null;

export type AdminLatestEvent = {
  eventType: string;
  severity: string;
  message: string;
  createdAt: string;
};

export type AdminConnectionSummary = {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string | null;
  provider: string;
  status: string;
  keyHint: string | null;
  lastConnectedAt: string | null;
  updatedAt: string | null;
  ownership: 'customer_workspace_owned';
  rawKeyVisibleToAdmin: false;
};

export type AdminLatestMetricsSnapshot = {
  id: string;
  provider: string;
  dateRange: string;
  source: string;
  revenue: number | null;
  orders: number | null;
  roas: number | null;
  adSpend: number | null;
  createdAt: string;
  sourceNote: string | null;
  sourceStatus: string | null;
  productionReady: boolean;
} | null;

const ZERO_COUNTS: AdminDbCounts = {
  users: 0,
  workspaces: 0,
  workspaceMembers: 0,
  connectedAccounts: 0,
  metricsSnapshots: 0,
  chatMessages: 0,
  briefs: 0,
  drafts: 0,
  usageLogs: 0,
  systemEvents: 0,
};

export async function getAdminDbCounts(): Promise<AdminDbCounts | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const result = await query<{
    users: string;
    workspaces: string;
    workspace_members: string;
    connected_accounts: string;
    metrics_snapshots: string;
    chat_history: string;
    briefs: string;
    drafts: string;
    usage_logs: string;
    system_events: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM workspaces) AS workspaces,
      (SELECT COUNT(*) FROM workspace_members) AS workspace_members,
      (SELECT COUNT(*) FROM connected_accounts) AS connected_accounts,
      (SELECT COUNT(*) FROM metrics_snapshots) AS metrics_snapshots,
      (SELECT COUNT(*) FROM chat_history) AS chat_history,
      (SELECT COUNT(*) FROM briefs) AS briefs,
      (SELECT COUNT(*) FROM drafts) AS drafts,
      (SELECT COUNT(*) FROM usage_logs) AS usage_logs,
      (SELECT COUNT(*) FROM system_events) AS system_events;
  `);

  const row = result.rows[0];
  if (!row) return ZERO_COUNTS;

  return {
    users: Number(row.users),
    workspaces: Number(row.workspaces),
    workspaceMembers: Number(row.workspace_members),
    connectedAccounts: Number(row.connected_accounts),
    metricsSnapshots: Number(row.metrics_snapshots),
    chatMessages: Number(row.chat_history),
    briefs: Number(row.briefs),
    drafts: Number(row.drafts),
    usageLogs: Number(row.usage_logs),
    systemEvents: Number(row.system_events),
  };
}

export async function getDefaultWorkspace(): Promise<AdminDefaultWorkspace> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const result = await query<{
    id: string;
    name: string;
    slug: string | null;
    status: string;
    plan_key: string;
    owner_email: string | null;
    created_at: Date;
  }>(`
    SELECT
      w.id,
      w.name,
      w.slug,
      w.status,
      w.plan_key,
      u.email AS owner_email,
      w.created_at
    FROM workspaces w
    LEFT JOIN users u ON u.id = w.owner_user_id
    ORDER BY w.created_at ASC
    LIMIT 1;
  `);

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    planKey: row.plan_key,
    ownerEmail: row.owner_email,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getLatestSystemEvents(limit = 5): Promise<AdminLatestEvent[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const result = await query<{
    event_type: string;
    severity: string;
    message: string;
    created_at: Date;
  }>(
    `SELECT event_type, severity, message, created_at
     FROM system_events
     ORDER BY created_at DESC
     LIMIT $1;`,
    [limit]
  );

  return result.rows.map((row) => ({
    eventType: row.event_type,
    severity: row.severity,
    message: row.message,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getConnectionSummaries(): Promise<AdminConnectionSummary[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const result = await query<{
    workspace_id: string;
    workspace_name: string;
    owner_email: string | null;
    provider: string;
    status: string;
    key_hint: string | null;
    last_connected_at: Date | null;
    updated_at: Date;
  }>(
    `SELECT
       ca.workspace_id,
       w.name AS workspace_name,
       owner.email AS owner_email,
       ca.provider,
       ca.status,
       ca.key_hint,
       ca.last_connected_at,
       ca.updated_at
     FROM connected_accounts ca
     INNER JOIN workspaces w ON w.id = ca.workspace_id
     LEFT JOIN users owner ON owner.id = w.owner_user_id
     ORDER BY w.created_at DESC, ca.provider ASC;`
  );

  return result.rows.map((row) => ({
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    ownerEmail: row.owner_email,
    provider: row.provider,
    status: row.status,
    keyHint: row.key_hint,
    lastConnectedAt: row.last_connected_at ? row.last_connected_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    ownership: 'customer_workspace_owned' as const,
    rawKeyVisibleToAdmin: false as const,
  }));
}


export async function getLatestMetricsSnapshotSummary(): Promise<AdminLatestMetricsSnapshot> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const result = await query<{
    id: string;
    provider: string;
    date_range: string;
    normalized_metrics: Record<string, any>;
    created_at: Date;
  }>(
    `SELECT id, provider, date_range, normalized_metrics, created_at
     FROM metrics_snapshots
     ORDER BY created_at DESC
     LIMIT 1;`
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider,
    dateRange: row.date_range,
    source: String(row.normalized_metrics?.source || 'database_snapshot'),
    revenue: Number.isFinite(Number(row.normalized_metrics?.revenue)) ? Number(row.normalized_metrics?.revenue) : null,
    orders: Number.isFinite(Number(row.normalized_metrics?.orders)) ? Number(row.normalized_metrics?.orders) : null,
    roas: Number.isFinite(Number(row.normalized_metrics?.roas)) ? Number(row.normalized_metrics?.roas) : null,
    adSpend: Number.isFinite(Number(row.normalized_metrics?.adSpend)) ? Number(row.normalized_metrics?.adSpend) : null,
    sourceNote: row.normalized_metrics?.sourceNote ? String(row.normalized_metrics.sourceNote) : null,
    sourceStatus: row.normalized_metrics?.sourceStatus ? String(row.normalized_metrics.sourceStatus) : null,
    productionReady: Boolean(row.normalized_metrics?.productionReady),
    createdAt: row.created_at.toISOString(),
  };
}


export type AdminOperationEvent = {
  id: string;
  eventType: string;
  severity: string;
  message: string;
  metadata: Record<string, any>;
  createdAt: string;
};

export type AdminSnapshotTimelineItem = {
  id: string;
  provider: string;
  dateRange: string;
  kind: string;
  source: string;
  sourceStatus: string | null;
  productionReady: boolean;
  coreMetricsProductionReady: boolean;
  revenue: number | null;
  orders: number | null;
  adSpend: number | null;
  roas: number | null;
  rawPayloadSizeChars: number;
  createdAt: string;
};

export type AdminBriefTimelineItem = {
  id: string;
  type: string;
  sourceSnapshotId: string | null;
  sourceStatus: string | null;
  productionReady: boolean;
  contentPreview: string;
  createdAt: string;
};

export type AdminUsageTimelineItem = {
  id: string;
  eventType: string;
  provider: string | null;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  metadata: Record<string, any>;
  createdAt: string;
};

function redactAdminValue(value: any, depth = 0): any {
  if (depth > 5) return '[TRUNCATED_DEPTH]';
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => redactAdminValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      const lower = key.toLowerCase();
      if (lower.includes('token') || lower.includes('secret') || lower.includes('password') || lower.includes('authorization') || lower.includes('cookie') || lower.includes('api_key') || lower === 'apikey' || lower === 'apiKey'.toLowerCase()) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactAdminValue(child, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 800) return `${value.slice(0, 800)}…[TRUNCATED]`;
  return value;
}

function classifySnapshot(dateRange: string, rawPayload: Record<string, any>, normalizedMetrics: Record<string, any>): string {
  const source = String(rawPayload?.source || normalizedMetrics?.source || '');
  const summaryProbe = rawPayload?.summaryProbe;
  if (summaryProbe?.ok === true) return 'summary_probe_success';
  if (summaryProbe?.ok === false) return 'summary_probe_error';
  if (dateRange.includes('summary_probe_error')) return 'summary_probe_error';
  if (dateRange.includes('api_key_validated')) return 'api_key_validation';
  if (source.includes('sample') || normalizedMetrics?.sourceStatus === 'sample_placeholder') return 'sample_placeholder';
  if (normalizedMetrics?.productionReady || normalizedMetrics?.coreMetricsProductionReady) return 'mapped_core_metrics';
  return 'unknown';
}

function numOrNull(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getAdminOperationEvents(workspaceId: string, limit = 30): Promise<AdminOperationEvent[]> {
  if (!isDatabaseConfigured) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const result = await query<{
    id: string;
    event_type: string;
    severity: string;
    message: string;
    metadata: Record<string, any>;
    created_at: Date;
  }>(
    `SELECT id, event_type, severity, message, metadata, created_at
     FROM system_events
     WHERE workspace_id = $1 OR workspace_id IS NULL
     ORDER BY created_at DESC
     LIMIT $2;`,
    [workspaceId, safeLimit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    severity: row.severity,
    message: row.message,
    metadata: redactAdminValue(row.metadata || {}),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getAdminSnapshotTimeline(workspaceId: string, limit = 30): Promise<AdminSnapshotTimelineItem[]> {
  if (!isDatabaseConfigured) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const result = await query<{
    id: string;
    provider: string;
    date_range: string;
    raw_payload: Record<string, any>;
    normalized_metrics: Record<string, any>;
    created_at: Date;
  }>(
    `SELECT id, provider, date_range, raw_payload, normalized_metrics, created_at
     FROM metrics_snapshots
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [workspaceId, safeLimit]
  );
  return result.rows.map((row) => {
    const rawText = JSON.stringify(row.raw_payload || {});
    const metrics = row.normalized_metrics || {};
    return {
      id: row.id,
      provider: row.provider,
      dateRange: row.date_range,
      kind: classifySnapshot(row.date_range, row.raw_payload || {}, metrics),
      source: String(metrics.source || row.raw_payload?.source || 'snapshot'),
      sourceStatus: metrics.sourceStatus ? String(metrics.sourceStatus) : null,
      productionReady: Boolean(metrics.productionReady),
      coreMetricsProductionReady: Boolean(metrics.coreMetricsProductionReady),
      revenue: numOrNull(metrics.revenue),
      orders: numOrNull(metrics.orders),
      adSpend: numOrNull(metrics.adSpend),
      roas: numOrNull(metrics.roas),
      rawPayloadSizeChars: rawText.length,
      createdAt: row.created_at.toISOString(),
    };
  });
}

export async function getAdminBriefTimeline(workspaceId: string, limit = 20): Promise<AdminBriefTimelineItem[]> {
  if (!isDatabaseConfigured) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const result = await query<{
    id: string;
    type: string;
    source_snapshot_id: string | null;
    content: string;
    metadata: Record<string, any>;
    created_at: Date;
  }>(
    `SELECT id, type, source_snapshot_id, content, metadata, created_at
     FROM briefs
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [workspaceId, safeLimit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    sourceSnapshotId: row.source_snapshot_id,
    sourceStatus: row.metadata?.sourceStatus ? String(row.metadata.sourceStatus) : null,
    productionReady: Boolean(row.metadata?.productionReady),
    contentPreview: row.content.length > 260 ? `${row.content.slice(0, 260)}…` : row.content,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getAdminUsageTimeline(workspaceId: string, limit = 20): Promise<AdminUsageTimelineItem[]> {
  if (!isDatabaseConfigured) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const result = await query<{
    id: string;
    event_type: string;
    provider: string | null;
    model: string | null;
    tokens_in: number | null;
    tokens_out: number | null;
    estimated_cost_usd: string | null;
    metadata: Record<string, any>;
    created_at: Date;
  }>(
    `SELECT id, event_type, provider, model, tokens_in, tokens_out, estimated_cost_usd, metadata, created_at
     FROM usage_logs
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [workspaceId, safeLimit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    provider: row.provider,
    model: row.model,
    tokensIn: Number(row.tokens_in || 0),
    tokensOut: Number(row.tokens_out || 0),
    estimatedCostUsd: Number(row.estimated_cost_usd || 0),
    metadata: redactAdminValue(row.metadata || {}),
    createdAt: row.created_at.toISOString(),
  }));
}
