-- LIFE.SAVER v0.6.0
-- Phase 2.10 — Local-only action fixtures example
--
-- Recommended command instead of manually running this SQL:
--   npm.cmd run db:seed:actions:local
--
-- Safety:
-- - This file is an example only.
-- - Do not run against production.
-- - It creates proposed action records only.
-- - It does not approve, queue, execute, publish, send, or change ads.

DO $$
DECLARE
  target_workspace_id UUID;
  actor_user_id UUID;
  instagram_action_id UUID;
BEGIN
  SELECT id INTO target_workspace_id
  FROM workspaces
  WHERE slug = 'lifesaver-dev'
  LIMIT 1;

  IF target_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace slug lifesaver-dev not found. Run npm.cmd run db:seed first or use the TypeScript fixture command.';
  END IF;

  SELECT wm.user_id INTO actor_user_id
  FROM workspace_members wm
  WHERE wm.workspace_id = target_workspace_id
    AND COALESCE(wm.status, 'active') = 'active'
    AND wm.role IN ('owner', 'admin')
  ORDER BY CASE wm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, wm.created_at ASC
  LIMIT 1;

  INSERT INTO actions (
    workspace_id,
    created_by_user_id,
    action_type,
    title,
    description,
    payload_json,
    status,
    risk_level,
    approval_required,
    policy_decision,
    idempotency_key,
    action_hash
  )
  SELECT
    target_workspace_id,
    actor_user_id,
    'content_publish',
    'Fixture: Proposed Instagram post',
    'Local-only proposed content_publish action for testing future approval queue views. It does not publish anything.',
    '{
      "schema_version": "action-payload/v0.6.0",
      "action_type": "content_publish",
      "source": "system",
      "intent_summary": "Proposed Instagram post fixture for approval queue testing only.",
      "data": {
        "platform": "instagram",
        "caption": "A calm founder check-in for local testing only.",
        "media_url": "https://example.test/local-fixtures/instagram-post-preview.png",
        "hashtags": ["ecommerce", "founderops", "lifesaver"],
        "scheduled_time": null
      }
    }'::jsonb,
    'proposed',
    'low',
    true,
    'ask',
    'local-fixture:v0.6.0:phase-2.10:instagram-post-sql-example',
    encode(digest('local-fixture:v0.6.0:phase-2.10:instagram-post-sql-example', 'sha256'), 'hex')
  WHERE NOT EXISTS (
    SELECT 1
    FROM actions
    WHERE workspace_id = target_workspace_id
      AND idempotency_key = 'local-fixture:v0.6.0:phase-2.10:instagram-post-sql-example'
  )
  RETURNING id INTO instagram_action_id;

  IF instagram_action_id IS NOT NULL THEN
    INSERT INTO action_events (
      action_id,
      workspace_id,
      actor_user_id,
      event_type,
      from_status,
      to_status,
      message,
      metadata_json
    )
    VALUES (
      instagram_action_id,
      target_workspace_id,
      actor_user_id,
      'action_created',
      NULL,
      'proposed',
      'Local-only Phase 2.10 SQL example fixture created. No external write/executor was run.',
      '{"fixture_key":"phase_2_10_sql_example_instagram_post","local_only":true,"external_write_enabled":false,"executor_enabled":false}'::jsonb
    );
  END IF;
END $$;
