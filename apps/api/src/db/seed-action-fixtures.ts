import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { closeDatabasePool, isDatabaseConfigured, query } from './pool.js';

type LocalActionFixture = {
  fixtureKey: string;
  actionType: string;
  title: string;
  description: string;
  status: 'proposed';
  riskLevel: 'low' | 'medium' | 'high';
  approvalRequired: true;
  policyDecision: 'ask';
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

const localActionFixtures: LocalActionFixture[] = [
  {
    fixtureKey: 'phase_2_10_proposed_instagram_post',
    actionType: 'content_publish',
    title: 'Fixture: Proposed Instagram post',
    description: 'Local-only proposed content_publish action for testing future approval queue views. It does not publish anything.',
    status: 'proposed',
    riskLevel: 'low',
    approvalRequired: true,
    policyDecision: 'ask',
    idempotencyKey: 'local-fixture:v0.6.0:phase-2.10:instagram-post',
    payload: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'system',
      intent_summary: 'Proposed Instagram post fixture for approval queue testing only.',
      created_reason: 'Phase 2.10 local QA fixture. No social platform API call is allowed.',
      risk_notes: ['Local fixture only', 'No executor is registered', 'No platform token is included'],
      idempotency_hint: 'phase-2-10-fixture-instagram-post',
      data: {
        platform: 'instagram',
        caption: 'A calm founder check-in: revenue is moving, ROAS needs attention, and the next step is disciplined optimisation. #ecommerce #founderops',
        post_type: 'image',
        media_url: 'https://example.test/local-fixtures/instagram-post-preview.png',
        hashtags: ['ecommerce', 'founderops', 'lifesaver'],
        scheduled_time: null,
        account_id_hint: 'sandbox-instagram-account',
        call_to_action_url: null,
        approval_notes: 'Fixture only. This must never publish to Instagram unless a future real executor is intentionally built and manually approved.',
      },
    },
  },
  {
    fixtureKey: 'phase_2_10_proposed_support_reply',
    actionType: 'support_reply_send',
    title: 'Fixture: Proposed support reply',
    description: 'Local-only proposed support_reply_send action for testing future approval queue views. It does not send anything.',
    status: 'proposed',
    riskLevel: 'medium',
    approvalRequired: true,
    policyDecision: 'ask',
    idempotencyKey: 'local-fixture:v0.6.0:phase-2.10:support-reply',
    payload: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'support_reply_send',
      source: 'system',
      intent_summary: 'Proposed support reply fixture for approval queue testing only.',
      created_reason: 'Phase 2.10 local QA fixture. No email/helpdesk API call is allowed.',
      risk_notes: ['Local fixture only', 'No send executor is registered', 'Customer email is synthetic'],
      idempotency_hint: 'phase-2-10-fixture-support-reply',
      data: {
        ticket_id: 'fixture-ticket-1001',
        thread_id: 'fixture-thread-1001',
        reply_body: 'Certainly — thank you for reaching out. I have checked the order note and the safest next step is for our team to review the delivery status before making any promise. We will update you shortly.',
        support_provider: 'sandbox_helpdesk',
        customer_email: 'customer.fixture@example.test',
        customer_name: 'Fixture Customer',
        subject: 'Question about order status',
        category: 'shipping',
        confidence_score: 0.82,
        sensitive_flag: false,
        escalation_required: false,
        approval_notes: 'Fixture only. This must never send an email or support message in V1/V2 foundation phases.',
      },
    },
  },
  {
    fixtureKey: 'phase_2_10_proposed_ad_budget_change',
    actionType: 'ad_budget_adjust',
    title: 'Fixture: Proposed ad budget change',
    description: 'Local-only proposed ad_budget_adjust action for testing future approval queue views. It does not change ad spend.',
    status: 'proposed',
    riskLevel: 'high',
    approvalRequired: true,
    policyDecision: 'ask',
    idempotencyKey: 'local-fixture:v0.6.0:phase-2.10:ad-budget-adjust',
    payload: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'ad_budget_adjust',
      source: 'system',
      intent_summary: 'Proposed Meta ad budget change fixture for approval queue testing only.',
      created_reason: 'Phase 2.10 local QA fixture. No ad platform API call is allowed.',
      risk_notes: ['Local fixture only', 'High risk because it represents money movement', 'No ads executor is registered'],
      idempotency_hint: 'phase-2-10-fixture-ad-budget-adjust',
      data: {
        platform: 'meta_ads',
        campaign_id: 'fixture-campaign-2001',
        current_budget: 100,
        proposed_budget: 85,
        change_amount: -15,
        currency: 'USD',
        account_id_hint: 'sandbox-meta-account',
        current_budget_period: 'daily',
        proposed_budget_period: 'daily',
        change_percent: -15,
        reason: 'Fixture scenario: ROAS softened and the system proposes reducing daily budget by 15%. This is not executable in this phase.',
        metric_window: 'last_24_hours',
        performance_snapshot: {
          roas: 1.55,
          paid_media_spend: 220.95,
          revenue: 342.54,
          orders: 6,
          source: 'synthetic_fixture_values_not_live_data',
        },
        rollback_budget: 100,
        approval_notes: 'Fixture only. Ad spend changes must remain blocked until ads connector, caps, approval, pause, and executor phases are completed.',
      },
    },
  },
];

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashFixtureAction(fixture: LocalActionFixture): string {
  return createHash('sha256')
    .update(stableStringify({
      action_type: fixture.actionType,
      fixture_key: fixture.fixtureKey,
      payload: fixture.payload,
    }))
    .digest('hex');
}

async function assertSafeLocalEnvironment() {
  const explicitOverride = process.env.ALLOW_LOCAL_ACTION_FIXTURES === 'true';
  const safeLocalMode = env.NODE_ENV !== 'production'
    && env.APP_ENVIRONMENT !== 'production'
    && env.DATABASE_ENVIRONMENT !== 'production'
    && env.CUSTOMER_ACCESS_MODE === 'local-testing';

  if (!safeLocalMode && !explicitOverride) {
    throw new Error(
      'Refusing to seed action fixtures outside local-testing mode. Set CUSTOMER_ACCESS_MODE=local-testing for local QA, or set ALLOW_LOCAL_ACTION_FIXTURES=true only for an intentional non-production test database.'
    );
  }
}

async function assertActionTablesExist() {
  const result = await query<{
    actions_table: string | null;
    action_events_table: string | null;
  }>(
    `SELECT
       to_regclass('public.actions')::text AS actions_table,
       to_regclass('public.action_events')::text AS action_events_table;`
  );

  const row = result.rows[0];
  if (!row?.actions_table || !row?.action_events_table) {
    throw new Error('Action tables are missing. Run npm.cmd run db:migrate before npm.cmd run db:seed:actions:local.');
  }
}

async function findTargetWorkspace() {
  const explicitWorkspaceId = process.env.ACTION_FIXTURE_WORKSPACE_ID;
  const workspaceSlug = process.env.ACTION_FIXTURE_WORKSPACE_SLUG || 'lifesaver-dev';

  if (explicitWorkspaceId) {
    const result = await query<{ id: string; owner_user_id: string | null; slug: string | null }>(
      `SELECT id, owner_user_id, slug
       FROM workspaces
       WHERE id = $1
       LIMIT 1;`,
      [explicitWorkspaceId]
    );
    return result.rows[0] ?? null;
  }

  const result = await query<{ id: string; owner_user_id: string | null; slug: string | null }>(
    `SELECT id, owner_user_id, slug
     FROM workspaces
     WHERE slug = $1
     ORDER BY created_at ASC
     LIMIT 1;`,
    [workspaceSlug]
  );

  return result.rows[0] ?? null;
}

async function findActorUserId(workspaceId: string, fallbackOwnerUserId: string | null): Promise<string | null> {
  const result = await query<{ user_id: string }>(
    `SELECT wm.user_id
     FROM workspace_members wm
     WHERE wm.workspace_id = $1
       AND COALESCE(wm.status, 'active') = 'active'
       AND wm.role IN ('owner', 'admin')
     ORDER BY CASE wm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, wm.created_at ASC
     LIMIT 1;`,
    [workspaceId]
  );

  return result.rows[0]?.user_id ?? fallbackOwnerUserId;
}

async function ensureFixtureAction(params: {
  workspaceId: string;
  actorUserId: string | null;
  fixture: LocalActionFixture;
}) {
  const actionHash = hashFixtureAction(params.fixture);

  const existing = await query<{ id: string; title: string; status: string }>(
    `SELECT id, title, status
     FROM actions
     WHERE workspace_id = $1
       AND (idempotency_key = $2 OR action_hash = $3)
     LIMIT 1;`,
    [params.workspaceId, params.fixture.idempotencyKey, actionHash]
  );

  if (existing.rows[0]) {
    return {
      actionId: existing.rows[0].id,
      title: existing.rows[0].title,
      status: existing.rows[0].status,
      inserted: false,
    };
  }

  const inserted = await query<{ id: string; title: string; status: string }>(
    `INSERT INTO actions (
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
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
     RETURNING id, title, status;`,
    [
      params.workspaceId,
      params.actorUserId,
      params.fixture.actionType,
      params.fixture.title,
      params.fixture.description,
      JSON.stringify(params.fixture.payload),
      params.fixture.status,
      params.fixture.riskLevel,
      params.fixture.approvalRequired,
      params.fixture.policyDecision,
      params.fixture.idempotencyKey,
      actionHash,
    ]
  );

  const actionId = inserted.rows[0].id;

  await query(
    `INSERT INTO action_events (
       action_id,
       workspace_id,
       actor_user_id,
       event_type,
       from_status,
       to_status,
       message,
       metadata_json
     )
     SELECT $1, $2, $3, 'action_created', NULL, $4, $5, $6::jsonb
     WHERE NOT EXISTS (
       SELECT 1
       FROM action_events
       WHERE action_id = $1
         AND event_type = 'action_created'
         AND metadata_json->>'fixture_key' = $7
     );`,
    [
      actionId,
      params.workspaceId,
      params.actorUserId,
      params.fixture.status,
      'Local-only Phase 2.10 fixture action created for QA. No external write/executor was run.',
      JSON.stringify({
        fixture_key: params.fixture.fixtureKey,
        phase: '2.10',
        local_only: true,
        external_write_enabled: false,
        executor_enabled: false,
      }),
      params.fixture.fixtureKey,
    ]
  );

  return {
    actionId,
    title: inserted.rows[0].title,
    status: inserted.rows[0].status,
    inserted: true,
  };
}

async function run() {
  if (!isDatabaseConfigured) {
    throw new Error('DATABASE_URL is not configured. Copy your working .env first, then run npm.cmd run db:seed:actions:local again.');
  }

  await assertSafeLocalEnvironment();
  await assertActionTablesExist();

  const workspace = await findTargetWorkspace();
  if (!workspace) {
    throw new Error('Target workspace was not found. Run npm.cmd run db:seed first, or set ACTION_FIXTURE_WORKSPACE_ID to an existing non-production workspace.');
  }

  const actorUserId = await findActorUserId(workspace.id, workspace.owner_user_id);

  const results = [];
  for (const fixture of localActionFixtures) {
    results.push(await ensureFixtureAction({ workspaceId: workspace.id, actorUserId, fixture }));
  }

  console.log(JSON.stringify({
    success: true,
    version: '0.6.0',
    phase: '2.10',
    message: 'Local-only V2 action fixtures are ready. No approval, execution, posting, sending, or ad changes were performed.',
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    actorUserId,
    insertedCount: results.filter((item) => item.inserted).length,
    skippedExistingCount: results.filter((item) => !item.inserted).length,
    actions: results,
    safety: {
      localOnly: true,
      noExternalWrites: true,
      noExecutors: true,
      noApprovalApi: true,
    },
  }, null, 2));
}

try {
  await run();
} finally {
  await closeDatabasePool();
}
