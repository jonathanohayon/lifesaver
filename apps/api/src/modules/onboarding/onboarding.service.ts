import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getWorkspaceOnboardingRow, recordOnboardingEvent, updateWorkspaceOnboardingStatus } from './onboarding.repository.js';
import type { OnboardingStatus, OnboardingStep } from './onboarding.types.js';

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for SaaS onboarding.');
  }
}

function buildStatus(row: NonNullable<Awaited<ReturnType<typeof getWorkspaceOnboardingRow>>>): OnboardingStatus {
  const hasTripleWhaleConnection = Boolean(row.triple_whale_has_key);
  const hasMetricsSnapshot = Number(row.metrics_count || 0) > 0;
  const hasDailyBrief = Number(row.daily_brief_count || 0) > 0;
  const hasWeeklySummary = Number(row.weekly_summary_count || 0) > 0;

  const steps: OnboardingStep[] = [
    {
      key: 'workspace_created',
      title: 'Workspace created',
      description: 'The customer account, workspace, owner membership, and Triple Whale placeholder are ready.',
      completed: true,
      actionLabel: 'View dashboard',
      actionUrl: './index.html',
    },
    {
      key: 'connect_triple_whale',
      title: 'Connect Triple Whale',
      description: 'Store the customer Triple Whale key encrypted on the backend. The raw key never returns to the browser.',
      completed: hasTripleWhaleConnection,
      actionLabel: 'Open settings',
      actionUrl: './settings.html',
    },
    {
      key: 'first_metrics_snapshot',
      title: 'Create first metrics snapshot',
      description: 'Run Summary Probe or Refresh Metrics so LIFE.SAVER has workspace-scoped business data.',
      completed: hasMetricsSnapshot,
      actionLabel: 'Open settings',
      actionUrl: './settings.html',
    },
    {
      key: 'first_daily_brief',
      title: 'Generate first Daily Brief',
      description: 'Create the first internal brief from stored metrics. This remains read/advice/draft-only.',
      completed: hasDailyBrief,
      actionLabel: 'Open admin',
      actionUrl: './admin.html',
    },
    {
      key: 'weekly_summary_ready',
      title: 'Weekly Summary foundation',
      description: 'Generate or wait for the first Weekly Summary. This confirms the brief pipeline is available.',
      completed: hasWeeklySummary,
      actionLabel: 'Open admin',
      actionUrl: './admin.html',
    },
  ];

  const completedSteps = steps.filter((step) => step.completed).length;
  const readyForDashboard = hasTripleWhaleConnection && hasMetricsSnapshot;
  const recommendedNextStep = steps.find((step) => !step.completed) || null;
  const computedStatus = readyForDashboard
    ? (hasDailyBrief && hasWeeklySummary ? 'dashboard_ready' : 'metrics_ready')
    : hasTripleWhaleConnection
      ? 'needs_metrics'
      : 'needs_connection';

  return {
    workspace: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      planKey: row.plan_key,
      status: row.status,
      onboardingStatus: row.onboarding_status || computedStatus,
      onboardingCompletedAt: row.onboarding_completed_at ? row.onboarding_completed_at.toISOString() : null,
    },
    progress: {
      completedSteps,
      totalSteps: steps.length,
      percent: Math.round((completedSteps / steps.length) * 100),
      readyForDashboard,
    },
    flags: {
      hasTripleWhaleConnection,
      hasMetricsSnapshot,
      hasDailyBrief,
      hasWeeklySummary,
    },
    steps,
    recommendedNextStep,
    safetyMode: 'read_advise_draft_only',
    message: readyForDashboard
      ? 'Workspace has the minimum data needed for the founder dashboard. Briefs and summaries can continue to improve from here.'
      : 'Continue onboarding by connecting Triple Whale and creating the first workspace-scoped metrics snapshot.',
  };
}

export async function getOnboardingStatus(workspaceId: string): Promise<OnboardingStatus> {
  assertDatabaseReady();
  const row = await getWorkspaceOnboardingRow(workspaceId);
  if (!row) {
    throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace was not found for onboarding.');
  }
  return buildStatus(row);
}

export async function refreshComputedOnboardingStatus(workspaceId: string, userId: string): Promise<OnboardingStatus> {
  const status = await getOnboardingStatus(workspaceId);
  const nextStatus = status.progress.readyForDashboard
    ? (status.flags.hasDailyBrief && status.flags.hasWeeklySummary ? 'dashboard_ready' : 'metrics_ready')
    : status.flags.hasTripleWhaleConnection
      ? 'needs_metrics'
      : 'needs_connection';

  await updateWorkspaceOnboardingStatus({
    workspaceId,
    onboardingStatus: nextStatus,
    completedAt: nextStatus === 'dashboard_ready' ? new Date() : null,
    metadata: { lastComputedAt: new Date().toISOString(), nextStatus, progressPercent: status.progress.percent },
  });

  await recordOnboardingEvent({
    workspaceId,
    userId,
    eventType: 'saas_onboarding_status_refreshed',
    message: `SaaS onboarding status refreshed: ${nextStatus}.`,
    metadata: { nextStatus, readyForDashboard: status.progress.readyForDashboard, progressPercent: status.progress.percent },
  });

  return getOnboardingStatus(workspaceId);
}
