-- LIFE.SAVER v0.7.0 Phase 12.3
-- Ticket Data Model.
-- Purpose: make the canonical support ticket schema explicit and add sensitivity metadata.
-- Safety: additive migration only. It does not call Gmail, send emails, create support replies,
-- execute actions, or expose raw provider payloads.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS body_snippet TEXT,
  ADD COLUMN IF NOT EXISTS sensitive_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sensitive_reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ticket_schema_version TEXT NOT NULL DEFAULT 'support_ticket_schema_v1';

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_sensitive_reasons_array_check
  CHECK (jsonb_typeof(sensitive_reasons_json) = 'array') NOT VALID;

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_sensitive_received
  ON support_tickets(workspace_id, sensitive_flag, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_category_status
  ON support_tickets(workspace_id, category, status, received_at DESC);

COMMENT ON COLUMN support_tickets.customer_email IS
  'Server-side customer email for support workflows. Browser responses should prefer a masked customerEmailHint unless full email display is explicitly approved.';

COMMENT ON COLUMN support_tickets.body_snippet IS
  'Cleaned short support body/snippet. Sensitive values should be redacted before browser display.';

COMMENT ON COLUMN support_tickets.sensitive_flag IS
  'True when a support ticket may contain sensitive payment, account, identity, health, compliance, or secret-like content.';

COMMENT ON COLUMN support_tickets.sensitive_reasons_json IS
  'Array of safe sensitivity reason labels. Must not contain raw secrets or raw provider payloads.';
