-- Stores raw Triple Whale payloads separately from normalized dashboard metrics.

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  date_range TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_started_at TIMESTAMPTZ,
  source_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_workspace_created ON metrics_snapshots(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_provider_range ON metrics_snapshots(provider, date_range, created_at DESC);
