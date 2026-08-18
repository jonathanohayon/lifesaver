import { env } from './config/env.js';

const checks = [

  {
    area: 'V2 Master Pause foundation',
    required: ['Confirm migration 013_create_autonomy_settings_table.sql exists', 'Run npm.cmd run db:migrate in the intended environment', 'Confirm autonomy_settings stores one row per workspace when future APIs create/update it', 'Confirm this phase has protected pause/resume APIs, executor pause guard helpers, and policy pause enforcement helpers; no registered executor and no external writes'],
    passHint: 'Phase 6.3 adds evaluateActionPolicy(action). No matching rule still defaults to ask/manual-review, and the evaluator never executes anything.',
  },

  {
    area: 'V2 action module structure',
    required: ['Confirm /api/v1/actions/module-status is registered', 'Confirm GET /api/v1/actions requires auth', 'Confirm list endpoint supports status/action_type/risk_level filters and pagination', 'Confirm GET /api/v1/actions/:id requires auth and returns safe payload preview', 'Confirm POST /api/v1/actions/:id/approve exists and requires owner/admin role', 'Confirm POST /api/v1/actions/:id/reject exists and requires owner/admin role', 'Confirm POST /api/v1/actions/:id/cancel exists and requires owner/admin role', 'Confirm approve/reject/cancel endpoints do not queue, execute, rollback, or write externally'],
    passHint: 'Phase 6.3 keeps policy behavior conservative after policy storage and default ask. Phase 4 UI and Phase 3 backend APIs remain internal and non-executing.',
  },
  {
    area: 'V2 local action fixtures',
    required: ['Run npm.cmd run db:seed:actions:local only in local testing', 'Confirm proposed Instagram/support/ad actions exist', 'Confirm no external writes occurred'],
    passHint: 'Fixtures create local proposed actions and action_created events only. They do not approve, queue, execute, post, send, or change ads.',
  },
  {
    area: 'V2 migration safety',
    required: ['Review Safe Migration Strategy', 'Confirm no destructive migration is planned', 'Confirm backup plan before production migration'],
    passHint: 'Phase 6.3 adds policy evaluation logic. Approval/rejection still record internal status only; no auto-run policy, executor APIs, or external writes are enabled.',
  },
  {
    area: 'V2 policy table schema',
    required: ['Confirm migration 015_create_policies_table.sql exists', 'Run npm.cmd run policy:schema:test', 'Run npm.cmd run db:migrate in the intended environment', 'Confirm policies table exists with workspace_id, action_type, conditions_json, decision, caps_json, priority, enabled, created_by, updated_by'],
    passHint: 'Phase 6.3 evaluates enabled policies and default ask behavior. It does not queue actions, execute actions, or write externally.',
  },
  {
    area: 'Local foundation',
    required: ['npm.cmd install', 'npm.cmd run db:status', 'npm.cmd run db:migrate'],
    passHint: 'Database configured=true and connected=true before app testing.',
  },
  {
    area: 'Auth and admin',
    required: ['Login page opens', 'Founder login works', 'Admin page requires auth token'],
    passHint: 'Admin shows API connected and database connected after login.',
  },
  {
    area: 'Triple Whale core metrics',
    required: ['Validate Triple Whale Key', 'Probe Summary API', 'Preview Metric Mapping'],
    passHint: 'coreMetricsProductionReady=true and productionReady=true for revenue/orders/AOV/ad spend/ROAS.',
  },
  {
    area: 'Dashboard live data',
    required: ['Hard refresh dashboard', 'Check no old demo values in live KPI areas'],
    passHint: 'No stale $9,068 / 142 / 3.40x values in live sections; demo modules are labelled.',
  },
  {
    area: 'Briefs',
    required: ['Generate Daily Brief', 'Generate Weekly Summary', 'Load Latest Brief', 'Load Latest Weekly Summary'],
    passHint: 'Briefs use live core metrics and do not say sample_placeholder.',
  },
  {
    area: 'Drafts',
    required: ['Create content draft', 'Create support reply draft', 'Approve/reject/reset draft'],
    passHint: 'Draft status changes only inside LIFE.SAVER; no external send/post action occurs.',
  },
  {
    area: 'Worker',
    required: ['npm.cmd run worker:status', 'npm.cmd run worker:once:daily', 'npm.cmd run worker:once:weekly'],
    passHint: 'Worker commands complete without Windows assertion crash and log system_events.',
  },
  {
    area: 'Claude',
    required: ['Safe fallback works with empty CLAUDE_API_KEY', 'Live mode works only after Claude key is set'],
    passHint: 'Claude key never appears in browser; chat_history and usage_logs record safe metadata.',
  },
  {
    area: 'Attribution / Pixel',
    required: ['Probe Attribution / Pixel API', 'Load Attribution Probe Response'],
    passHint: 'Attribution diagnostics do not overwrite core dashboard metrics and remain non-production until confirmed.',
  },
  {
    area: 'Security',
    required: ['npm.cmd run security:check', 'Load Security Status'],
    passHint: 'Local may show productionReady=false; production requires rotated secrets, HTTPS, and production env.',
  },
  {
    area: 'Environment separation',
    required: ['npm.cmd run env:check', 'Verify dev/staging/prod separation docs'],
    passHint: 'Development and production databases/secrets are not mixed.',
  },
];

const payload = {
  version: '0.6.0',
  mode: 'V2 Phase 8.10 Safe Demo QA',
  nodeEnv: env.NODE_ENV,
  appEnvironment: env.APP_ENVIRONMENT,
  databaseEnvironment: env.DATABASE_ENVIRONMENT,
  safety: 'V1 remains read + advise + draft only. V2 Phase 8.10 adds Safe Demo QA for Draft -> Proposed Action -> Approval -> Sandbox Execution -> Result Log, while preserving Phase 8.9 rollback simulation, Phase 8.8 forced failure QA, Phase 7 Rules UI, Phase 6 policy safeguards, and sandbox result logging. No real executor, no external write connector, no auto-run execution, no real content publishing, no support sending, no real ad changes, no real rollback execution, and no external write/action execution is enabled.',
  productionNote: 'This command is a checklist helper. It does not prove production readiness by itself; complete the manual checklist and capture evidence before client handoff.',
  checks,
};

console.log(JSON.stringify(payload, null, 2));
