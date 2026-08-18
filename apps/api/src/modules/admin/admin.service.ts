import { env } from '../../config/env.js';
import { getEmergencySafeModeState } from '../autonomy/emergency-safe-mode.js';
import { getDatabaseStatus } from '../../db/status.js';
import type { AdminOverviewResponse } from './admin.types.js';
import { getAdminDbCounts, getConnectionSummaries, getDefaultWorkspace, getLatestSystemEvents, getLatestMetricsSnapshotSummary, getAdminOperationEvents, getAdminSnapshotTimeline, getAdminBriefTimeline, getAdminUsageTimeline } from './admin.repository.js';

export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  const databaseStatus = await getDatabaseStatus();
  const emergencySafeMode = getEmergencySafeModeState();

  let counts: AdminOverviewResponse['databaseSummary']['counts'] = null;
  let defaultWorkspace: AdminOverviewResponse['databaseSummary']['defaultWorkspace'] = null;
  let latestEvents: AdminOverviewResponse['databaseSummary']['latestEvents'] = [];
  let connectionSummaries: AdminOverviewResponse['databaseSummary']['connectionSummaries'] = [];
  let latestMetricsSnapshot: AdminOverviewResponse['databaseSummary']['latestMetricsSnapshot'] = null;

  if (databaseStatus.connected) {
    counts = await getAdminDbCounts();
    defaultWorkspace = await getDefaultWorkspace();
    latestEvents = await getLatestSystemEvents(5);
    connectionSummaries = await getConnectionSummaries();
    latestMetricsSnapshot = await getLatestMetricsSnapshotSummary();
  }

  const seeded = Boolean(defaultWorkspace && counts && counts.users > 0 && counts.workspaces > 0);

  return {
    app: {
      name: 'LIFE.SAVER',
      version: '0.7.5',
      mode: 'V2 Phase 5.10 Pause QA + Pause Switch UI',
      environment: env.NODE_ENV,
    },
    architecture: {
      currentStage: 'v0.7.5 Mobile Operator UI Release QA: LIFE.SAVER has completed the V2 release-readiness foundation with approvals, policy gates, master pause, sandbox/real-executor-capable safety checks, audit/result logs, rollback handling where supported, cost/anomaly hardening, and no-hidden-autonomy controls.',
      v1Scope: 'Founder/customer workspaces using Triple Whale as the only business data source and Claude as server-side assistant. Still read, advise, and draft only.',
      futureSaasDirection: 'Multi-workspace subscription product where each customer has isolated data, API keys, metrics, briefs, drafts, and usage limits.',
      dataOwnershipRule: 'Code can be updated safely; customer data must remain protected in PostgreSQL and tied to workspace_id.',
    },
    workspaceModel: {
      currentV1: 'One customer user -> one private workspace -> one Triple Whale connection -> one dashboard; future workspace switching remains controlled by membership.',
      futureSaas: 'Many users -> many workspaces -> each workspace has isolated connected accounts, metrics, briefs, drafts, and billing.',
      isolationRule: 'Every production table that stores customer/business data must include workspace_id before real SaaS launch.',
    },
    emergencySafeMode: {
      active: emergencySafeMode.active,
      reason: emergencySafeMode.reason,
      adminWarningVisible: emergencySafeMode.adminWarningVisible,
      executionBlocked: emergencySafeMode.executionBlocked,
      autoApprovalAllowed: emergencySafeMode.autoApprovalAllowed,
      executorExecutionAllowed: emergencySafeMode.executorExecutionAllowed,
      envKey: emergencySafeMode.envKey,
      warning: emergencySafeMode.active
        ? 'EMERGENCY SAFE MODE ACTIVE: all future execution is blocked. Resume does not execute waiting actions.'
        : 'Emergency safe mode is not active. Normal approval, pause, policy, and executor guards still apply.',
    },
    databaseSummary: {
      connected: databaseStatus.connected,
      seeded,
      counts,
      defaultWorkspace,
      latestEvents,
      connectionSummaries,
      latestMetricsSnapshot,
    },
    adminPanels: [
      { key: 'system', name: 'System Status', purpose: 'Check API health, app version, environment, and deployment status.', status: 'ready' },
      { key: 'auth', name: 'Authentication', purpose: 'Founder/super-admin login, token issuing, protected admin APIs, and future SaaS user context.', status: seeded ? 'ready' : 'planned' },
      { key: 'database', name: 'Database Foundation', purpose: 'Check PostgreSQL status, migration readiness, seeds, and core table counts.', status: databaseStatus.connected ? 'ready' : 'planned' },
      { key: 'users', name: 'Users', purpose: 'Monitor customer accounts and future team access. v0.5.3 adds workspace-scoped team member management from Customer Settings.', status: seeded ? 'ready' : 'planned' },
      { key: 'workspaces', name: 'Workspaces', purpose: 'Manage each business dashboard and keep customer data isolated.', status: seeded ? 'ready' : 'planned' },
      { key: 'connections', name: 'Connected Accounts', purpose: 'Monitor Triple Whale connection status without exposing API keys. Customer Settings owns key management; Super Admin monitors status without raw keys.', status: counts && counts.connectedAccounts > 0 ? 'ready' : 'planned' },
      { key: 'metrics', name: 'Metric Snapshots', purpose: 'Inspect latest synced Triple Whale snapshots and sync status.', status: latestMetricsSnapshot ? 'ready' : 'planned' },
      { key: 'briefs', name: 'Briefs', purpose: 'Review Daily Briefs and Weekly Summaries generated from stored metrics.', status: counts && counts.briefs > 0 ? 'ready' : 'planned' },
      { key: 'drafts', name: 'Drafts', purpose: 'Review content/support drafts before founder approval.', status: counts && counts.drafts > 0 ? 'ready' : 'planned' },
      { key: 'worker', name: 'Worker Automation', purpose: 'Run read-only metrics refresh and generate Daily/Weekly briefs on a schedule.', status: 'ready' },
      { key: 'opslog', name: 'Admin Logs & Snapshot History', purpose: 'Review system events, metrics snapshot timeline, brief history, and AI usage without digging through raw JSON or Supabase tables.', status: 'ready' },
      { key: 'emergency_safe_mode', name: 'Emergency Safe Mode', purpose: 'Environment-level override using EMERGENCY_SAFE_MODE=true. When active, all future executor execution is blocked and admin warning is visible.', status: emergencySafeMode.active ? 'ready' : 'planned' },
      { key: 'security', name: 'Production Security', purpose: 'Review production readiness: secret strength, auth gating, CORS, debug controls, rate limits, and worker secret configuration.', status: 'ready' },
      { key: 'usage', name: 'AI Usage & Cost', purpose: 'Track Claude usage, rate limits, estimated cost, and safety limits.', status: 'planned' },
      { key: 'billing', name: 'Billing', purpose: 'Future subscription status, plan limits, and payment integration.', status: 'planned' },
    ],
    apiEndpoints: [
      { method: 'GET', path: '/api/v1/health', purpose: 'Deployment and API health check.', status: 'ready' },
      { method: 'GET', path: '/api/v1/database/status', purpose: 'Checks whether PostgreSQL is configured and reachable.', status: 'ready' },
      { method: 'POST', path: '/api/v1/auth/signup', purpose: 'v0.5.3 SaaS signup. Creates a customer user, private workspace, owner membership, and Triple Whale placeholder. Controlled by SAAS_SIGNUP_ENABLED.', status: 'ready' },
      { method: 'POST', path: '/api/v1/auth/login', purpose: 'Founder/customer login. Returns a server-signed token scoped to one current workspace.', status: 'ready' },
      { method: 'GET', path: '/api/v1/auth/me', purpose: 'Returns current logged-in user/workspace context from token.', status: 'ready' },
      { method: 'POST', path: '/api/v1/auth/logout', purpose: 'Frontend clears local token. Server remains stateless in v0.5.3.', status: 'ready' },
      { method: 'GET', path: '/api/v1/admin/overview', purpose: 'Protected super admin architecture/status overview with database counts.', status: 'ready' },
      { method: 'GET', path: '/api/v1/admin/operations-log', purpose: 'Protected Super Admin operational log: system events, metrics snapshots, brief history, and usage logs.', status: 'ready' },
      { method: 'GET', path: '/api/v1/security/status', purpose: 'Protected Super Admin security report with production-readiness checks. Never exposes raw secrets.', status: 'ready' },
      { method: 'GET', path: '/api/v1/workspaces', purpose: 'Lists only workspaces where the authenticated user is an active member. Tenant isolation foundation.', status: 'ready' },
      { method: 'GET', path: '/api/v1/workspaces/current', purpose: 'Returns the authenticated token workspace context. Frontend cannot choose arbitrary workspace IDs.', status: 'ready' },
      { method: 'GET', path: '/api/v1/product-surfaces', purpose: 'Public-safe product surface/access model for mydomain.com, app.mydomain.com, admin.mydomain.com, api.mydomain.com, and private worker service.', status: 'ready' },
      { method: 'GET', path: '/api/v1/launch-readiness', purpose: 'Protected customer/domain launch readiness report: checks production URLs, CORS, auth, database SSL, secrets, worker privacy, and v1 read-only safety before customer access.', status: 'ready' },
      { method: 'GET', path: '/api/v1/customer-settings', purpose: 'Protected customer workspace settings summary: profile, role, Claude ownership rule, and customer-owned Triple Whale ownership rule.', status: 'ready' },
      { method: 'PATCH', path: '/api/v1/customer-settings/workspace-profile', purpose: 'Protected customer workspace profile update. Stores business name/domain/timezone/currency against the authenticated workspace only.', status: 'ready' },
      { method: 'GET', path: '/api/v1/team/members', purpose: 'Protected workspace team member list. Returns only members in the authenticated workspace.', status: 'ready' },
      { method: 'POST', path: '/api/v1/team/members', purpose: 'Protected owner/admin team member add foundation. Creates invited placeholder users when needed; no email is sent yet.', status: 'ready' },
      { method: 'PATCH', path: '/api/v1/team/members/:membershipId', purpose: 'Protected owner/admin role update for admin/member/viewer roles. Owner transfer remains protected.', status: 'ready' },
      { method: 'DELETE', path: '/api/v1/team/members/:membershipId', purpose: 'Protected owner/admin soft-remove from workspace. Last owner/self-removal are blocked.', status: 'ready' },
      { method: 'GET', path: '/api/v1/onboarding/status', purpose: 'Returns SaaS onboarding progress for the authenticated workspace.', status: 'ready' },
      { method: 'POST', path: '/api/v1/onboarding/refresh-status', purpose: 'Recomputes workspace onboarding status from connected account, metrics, and brief records.', status: 'ready' },
      { method: 'GET', path: '/api/v1/metrics', purpose: 'Latest ecommerce metrics for dashboard panels. Reads latest database snapshot when available, then falls back to mock data.', status: latestMetricsSnapshot ? 'ready' : 'mock' },
      { method: 'POST', path: '/api/v1/chat', purpose: 'Server-side LIFE.SAVER chat endpoint with safe Claude/fallback mode and chat draft auto-save.', status: 'ready' },
      { method: 'GET', path: '/api/v1/brief', purpose: 'Latest Daily Brief. Reads stored DB brief first, then generates safe template from latest metrics, then falls back to mock.', status: counts && counts.briefs > 0 ? 'ready' : 'mock' },
      { method: 'POST', path: '/api/v1/brief/generate', purpose: 'Protected generation of a Daily Brief from the latest stored metrics snapshot.', status: 'ready' },
      { method: 'GET', path: '/api/v1/weekly', purpose: 'Latest Weekly Summary. Reads stored DB summary first, then generates safe template from latest metrics, then falls back to mock.', status: counts && counts.briefs > 0 ? 'ready' : 'mock' },
      { method: 'POST', path: '/api/v1/weekly/generate', purpose: 'Protected generation of a Weekly Summary from the latest stored metrics snapshot.', status: 'ready' },
      { method: 'GET', path: '/api/v1/drafts', purpose: 'Protected list of saved content/support drafts for founder review.', status: 'ready' },
      { method: 'POST', path: '/api/v1/drafts/content', purpose: 'Protected draft-only content generation. Does not post externally.', status: 'ready' },
      { method: 'POST', path: '/api/v1/drafts/support-reply', purpose: 'Protected draft-only support reply generation. Does not send externally.', status: 'ready' },
      { method: 'PATCH', path: '/api/v1/drafts/:id/status', purpose: 'Protected internal draft status update. Does not publish or send.', status: 'ready' },
      { method: 'GET', path: '/api/v1/worker/status', purpose: 'Internal worker status/config endpoint protected by WORKER_SHARED_SECRET.', status: 'ready' },
      { method: 'POST', path: '/api/v1/worker/run/metrics_refresh', purpose: 'Internal worker endpoint to refresh read-only Triple Whale metrics.', status: 'ready' },
      { method: 'POST', path: '/api/v1/worker/run/daily_pipeline', purpose: 'Internal worker endpoint to refresh metrics and generate Daily Brief.', status: 'ready' },
      { method: 'POST', path: '/api/v1/worker/run/weekly_pipeline', purpose: 'Internal worker endpoint to refresh metrics and generate Weekly Summary.', status: 'ready' },
      { method: 'GET', path: '/api/v1/connect/triplewhale/status', purpose: 'Protected Triple Whale connection status. Never returns the raw key.', status: 'ready' },
      { method: 'POST', path: '/api/v1/triple-whale/test-connection', purpose: 'Protected server-side read-only Triple Whale test. Does not expose raw key and does not normalize guessed fields.', status: 'ready' },
      { method: 'POST', path: '/api/v1/connect/triplewhale', purpose: 'Encrypts and stores the Triple Whale API key server-side.', status: 'ready' },
      { method: 'DELETE', path: '/api/v1/connect/triplewhale', purpose: 'Disconnects Triple Whale and removes the stored encrypted key.', status: 'ready' },
      { method: 'POST', path: '/api/v1/refresh-metrics', purpose: 'Protected manual metrics refresh. v0.5.2 validates the API key live and stores a safe snapshot until Summary body mapping is finalized.', status: 'ready' },
      { method: 'POST', path: '/api/v1/triple-whale/refresh-metrics', purpose: 'Namespaced version of the manual Triple Whale metrics refresh endpoint.', status: 'ready' },
      { method: 'POST', path: '/api/v1/triple-whale/summary-probe', purpose: 'Protected Summary Page probe. Uses the captured Summary payload builder or JSON override and stores Summary Probe response/error diagnostics for mapping review.', status: 'ready' },
      { method: 'GET', path: '/api/v1/triple-whale/mapping-preview', purpose: 'Protected v0.5.2 metric mapping preview that prefers Summary Probe snapshots over API-key validation placeholders.', status: 'ready' },
      { method: 'GET', path: '/api/v1/triple-whale/latest-raw-response?kind=summary_probe', purpose: 'Protected redacted Summary Probe raw response preview. Sensitive auth/user fields are removed from browser output.', status: 'ready' },
      { method: 'GET', path: '/api/v1/triple-whale/snapshot-history', purpose: 'Protected Triple Whale snapshot history with explicit snapshot kind labels for debugging.', status: 'ready' },
    ],
    safetyRules: [
      'Claude API key and Triple Whale API key must never be exposed to the browser.',
      'V1 remains read, advise, and draft only.',
      'No automatic posting, sending, refunding, ad spend changes, campaign edits, or external writes in v1.',
      'EMERGENCY_SAFE_MODE=true must block all future executor execution and force policy away from auto-approval.',
      'Raw Triple Whale payloads must be stored separately from normalized dashboard metrics.',
      'Sample placeholder metrics must be clearly labelled and must not be treated as production truth.',
      'If data is missing, LIFE.SAVER must say it is missing instead of inventing metrics.',
      'Future customer data must always be isolated by workspace_id.',
      'v0.5.3 signup creates one private workspace per new customer; customer settings and connected accounts must stay token-workspace scoped.',
      'Debug/admin endpoints must be protected before production.',
      'Default development password must be changed before production or client handoff.',
    ],
    nextMilestones: [
      'Run npm.cmd run db:seed after migrations to ensure the default founder has a development password.',
      'Log in at /login.html using the local development founder account.',
      'Confirm protected admin overview works only after login.',
      'Test encrypted Triple Whale key storage from Customer Settings -> Connected Accounts.',
      'Use Customer Settings or Admin Refresh Metrics button to store a validated metrics snapshot.',
      'Use the Test Triple Whale Connection button to validate the encrypted Triple Whale key server-side through the official API key validation endpoint.',
      'Confirm the exact Triple Whale Summary Page request body, enable TRIPLE_WHALE_SUMMARY_BODY_JSON, run Summary Probe, then review Preview Metric Mapping before treating normalized metrics as production truth.',
      'Test worker one-off commands: npm.cmd run worker:status, npm.cmd run worker:once:daily, and npm.cmd run worker:once:weekly. Keep WORKER_ENABLED=false until scheduled local automation is intentionally enabled.',
    ],
  };
}


export async function getAdminOperationsLog(workspaceId: string, limit = 25) {
  const databaseStatus = await getDatabaseStatus();
  if (!databaseStatus.connected) {
    return {
      connected: false,
      message: 'Database is not connected, so admin operations log cannot be loaded.',
      generatedAt: new Date().toISOString(),
      systemEvents: [],
      metricsSnapshots: [],
      briefHistory: [],
      usageLogs: [],
      safetyNote: 'No secrets are exposed in admin log previews.',
    };
  }

  const [systemEvents, metricsSnapshots, briefHistory, usageLogs] = await Promise.all([
    getAdminOperationEvents(workspaceId, limit),
    getAdminSnapshotTimeline(workspaceId, limit),
    getAdminBriefTimeline(workspaceId, Math.min(limit, 20)),
    getAdminUsageTimeline(workspaceId, Math.min(limit, 20)),
  ]);

  return {
    connected: true,
    message: 'v0.5.3 admin operations log loaded. Use this panel to review worker runs, sync attempts, snapshot health, generated briefs, and AI usage without opening Supabase for every check.',
    generatedAt: new Date().toISOString(),
    counts: {
      systemEvents: systemEvents.length,
      metricsSnapshots: metricsSnapshots.length,
      briefHistory: briefHistory.length,
      usageLogs: usageLogs.length,
    },
    systemEvents,
    metricsSnapshots,
    briefHistory,
    usageLogs,
    safetyNote: 'Raw API keys, tokens, cookies, and secret-like fields are redacted from admin browser previews. Full raw provider payloads remain developer-sensitive and should not be shared publicly.',
  };
}
