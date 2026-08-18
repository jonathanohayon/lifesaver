-- LIFE.SAVER v0.7.0
-- Phase 15.4 — Memory Table
-- Purpose: additive workspace-scoped memory schema for brand voice, approved content style,
-- support tone, past decisions, discount policy, banned phrases, and founder preferences.
-- Safety: this migration creates memory storage only. It does not add memory UI, automatic
-- memory capture, Claude prompt injection, specialist execution, tool invocation, action creation,
-- external connector calls, executor calls, auto-run, or cross-workspace recall.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'workspace',
  title TEXT NOT NULL,
  value_text TEXT NOT NULL,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'suggested',
  sensitivity TEXT NOT NULL DEFAULT 'normal',
  source TEXT NOT NULL DEFAULT 'unspecified',
  confidence_score NUMERIC(5,4),
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT memory_items_type_check CHECK (
    memory_type IN (
      'brand_voice',
      'approved_content_style',
      'support_tone',
      'past_decision',
      'discount_policy',
      'banned_phrase',
      'founder_preference'
    )
  ),

  CONSTRAINT memory_items_scope_check CHECK (
    scope IN ('workspace', 'content', 'support', 'ads', 'founder', 'global_safe_default')
  ),

  CONSTRAINT memory_items_status_check CHECK (
    status IN ('suggested', 'active', 'disabled', 'archived')
  ),

  CONSTRAINT memory_items_sensitivity_check CHECK (
    sensitivity IN ('normal', 'sensitive_business', 'restricted_no_prompt_injection')
  ),

  CONSTRAINT memory_items_confidence_check CHECK (
    confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
  ),

  CONSTRAINT memory_items_value_json_object_check CHECK (
    jsonb_typeof(value_json) = 'object'
  ),

  CONSTRAINT memory_items_title_not_blank_check CHECK (
    length(trim(title)) > 0
  ),

  CONSTRAINT memory_items_value_text_not_blank_check CHECK (
    length(trim(value_text)) > 0
  ),

  CONSTRAINT memory_items_active_requires_approval_check CHECK (
    status <> 'active' OR approved_by_user_id IS NOT NULL OR source = 'founder_manual'
  ),

  CONSTRAINT memory_items_disabled_has_timestamp_check CHECK (
    status <> 'disabled' OR disabled_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_memory_items_workspace_type_status
  ON memory_items(workspace_id, memory_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_items_workspace_scope_status
  ON memory_items(workspace_id, scope, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_items_workspace_tags_gin
  ON memory_items USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_memory_items_created_by
  ON memory_items(created_by_user_id, created_at DESC)
  WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memory_items_approved_by
  ON memory_items(approved_by_user_id, approved_at DESC)
  WHERE approved_by_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_items_active_unique_title
  ON memory_items(workspace_id, memory_type, lower(title))
  WHERE status = 'active';

COMMENT ON TABLE memory_items IS
  'Phase 15.4 workspace-scoped memory schema. Stores brand voice, approved content style, support tone, past decisions, discount policy, banned phrases, and founder preferences. This table does not create memory UI, automatic memory capture, Claude prompt injection, tool calls, actions, executors, external connector calls, auto-run, or cross-workspace recall.';

COMMENT ON COLUMN memory_items.workspace_id IS
  'Workspace that owns this memory item. Future reads must remain workspace-scoped.';

COMMENT ON COLUMN memory_items.memory_type IS
  'Supported Phase 15.4 memory type: brand_voice, approved_content_style, support_tone, past_decision, discount_policy, banned_phrase, or founder_preference.';

COMMENT ON COLUMN memory_items.scope IS
  'Future context scope where the memory may be considered after review: workspace, content, support, ads, founder, or global_safe_default.';

COMMENT ON COLUMN memory_items.value_text IS
  'Safe reviewed summary text only. Must never contain API keys, raw provider payloads, raw emails, raw customer private data, prompt-injection instructions, or secrets.';

COMMENT ON COLUMN memory_items.value_json IS
  'Optional safe structured details only. Must never contain raw provider payloads, API keys, raw MIME/base64, request headers, or secrets.';

COMMENT ON COLUMN memory_items.status IS
  'suggested memory is reviewable; active memory may be used by future UI/orchestrator only after explicit approval; disabled/archived memory must not be injected into prompts.';

COMMENT ON COLUMN memory_items.sensitivity IS
  'Sensitivity marker for future UI and prompt-assembly controls. restricted_no_prompt_injection must not be injected into Claude prompts.';
