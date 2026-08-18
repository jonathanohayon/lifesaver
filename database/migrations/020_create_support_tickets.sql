-- LIFE.SAVER v0.7.0 Phase 12.2
-- Read-only support ticket import.
-- Purpose: store normalized support tickets imported from Gmail read-only messages.
-- Safety: additive migration only. It does not send emails, modify Gmail,
-- create replies, execute support actions, or call any external service.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  from_email_hint TEXT,
  from_name_hint TEXT,
  subject TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  category TEXT NOT NULL DEFAULT 'uncategorized',
  sentiment TEXT NOT NULL DEFAULT 'unknown',
  labels_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_provider_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT support_tickets_provider_check CHECK (provider IN ('gmail')),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'pending_review', 'closed', 'spam', 'archived')),
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT support_tickets_category_check CHECK (
    category IN ('uncategorized', 'order_status', 'shipping', 'returns', 'refunds', 'product_question', 'complaint', 'vip', 'spam')
  ),
  CONSTRAINT support_tickets_sentiment_check CHECK (sentiment IN ('unknown', 'positive', 'neutral', 'negative')),
  CONSTRAINT support_tickets_labels_array_check CHECK (jsonb_typeof(labels_json) = 'array'),
  CONSTRAINT support_tickets_raw_payload_object_check CHECK (jsonb_typeof(raw_provider_payload_json) = 'object'),
  CONSTRAINT support_tickets_external_message_not_blank_check CHECK (char_length(trim(external_message_id)) > 0),
  CONSTRAINT support_tickets_external_thread_not_blank_check CHECK (char_length(trim(external_thread_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_workspace_provider_message
  ON support_tickets(workspace_id, provider, external_message_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_received
  ON support_tickets(workspace_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_status_received
  ON support_tickets(workspace_id, status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_priority_received
  ON support_tickets(workspace_id, priority, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_thread
  ON support_tickets(workspace_id, provider, external_thread_id);

COMMENT ON TABLE support_tickets IS
  'Normalized support tickets imported from read-only provider messages. Phase 12.2 stores Gmail messages as support tickets and does not send replies or modify Gmail.';

COMMENT ON COLUMN support_tickets.raw_provider_payload_json IS
  'Raw provider payload snapshot separated from normalized ticket fields. Must not contain OAuth tokens, Authorization headers, passwords, API keys, or email send credentials.';

COMMENT ON COLUMN support_tickets.from_email_hint IS
  'Safe customer email hint for support review. Avoid storing provider credentials or internal secrets here.';
