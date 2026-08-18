import { z } from 'zod';
import { DEFAULT_NOTIFICATION_PREFERENCES_ROW } from './notification-preferences.model.js';
import { buildSecureApprovalReviewUrl } from './notification-secure-approval-links.model.js';
import { enforceQuietHoursForNotification } from './notification-quiet-hours.model.js';
import type {
  NotificationTriggerDecision,
  NotificationTriggerEvaluation,
  NotificationTriggerInput,
  NotificationTriggerPreferencesSnapshot,
  NotificationTriggerType,
} from './notification-triggers.types.js';

export const NOTIFICATION_TRIGGERS_PHASE = 'phase_10_5_notification_event_triggers' as const;
export const NOTIFICATION_TRIGGERS_VERSION = '0.7.0' as const;

const approvalStatuses = new Set(['proposed', 'approval_required']);
const failureStatuses = new Set(['failed']);
const highRiskLevels = new Set(['high', 'critical']);
const secretPattern = /(access[_ -]?token|refresh[_ -]?token|authorization|bearer\s+|api[_ -]?key|client[_ -]?secret|password\s*[:=]|database[_ -]?url|app[_ -]?encryption[_ -]?key|worker[_ -]?shared[_ -]?secret|raw[_ -]?payload|payload[_ -]?json|rollback[_ -]?payload|encrypted[_ -]?)/i;

export const notificationTriggerInputSchema = z.object({
  actionId: z.string().trim().min(1).max(120),
  workspaceId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(220),
  actionType: z.string().trim().min(1).max(80),
  status: z.string().trim().min(1).max(80),
  riskLevel: z.string().trim().min(1).max(40),
  approvalRequired: z.boolean(),
  policyDecision: z.string().trim().min(1).max(80),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string(), z.null()]).optional(),
  lastEventType: z.string().trim().max(120).nullable().optional(),
  lastEventMessage: z.string().trim().max(700).nullable().optional(),
  lastEventAt: z.union([z.date(), z.string(), z.null()]).optional(),
  reminderCount: z.number().int().min(0).max(1000).optional(),
  lastReminderAt: z.union([z.date(), z.string(), z.null()]).optional(),
}).strict();

export const notificationTriggerPreferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  slackEnabled: z.literal(false),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  quietHoursEnd: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  quietHoursTimezone: z.string().trim().min(3).max(80),
  approvalEscalationMinutes: z.number().int().min(5).max(1440),
  repeatEscalationMinutes: z.number().int().min(5).max(1440),
  maxEscalations: z.number().int().min(0).max(10),
}).strict();

function toDate(value: Date | string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
}

function cleanText(value: string, max: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, max);
  if (secretPattern.test(normalized)) return '[redacted unsafe text]';
  return normalized;
}

export function defaultNotificationTriggerPreferences(): NotificationTriggerPreferencesSnapshot {
  return {
    inAppEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.in_app_enabled,
    emailEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.email_enabled,
    slackEnabled: false,
    quietHoursEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_enabled,
    quietHoursStart: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_start,
    quietHoursEnd: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_end,
    quietHoursTimezone: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_timezone,
    approvalEscalationMinutes: DEFAULT_NOTIFICATION_PREFERENCES_ROW.approval_escalation_minutes,
    repeatEscalationMinutes: DEFAULT_NOTIFICATION_PREFERENCES_ROW.repeat_escalation_minutes,
    maxEscalations: DEFAULT_NOTIFICATION_PREFERENCES_ROW.max_escalations,
  };
}

function reviewUrlFor(actionId: string): string {
  return buildSecureApprovalReviewUrl({ actionId, source: 'notification_trigger' }).reviewUrl;
}

function priorityFor(triggerType: NotificationTriggerType, riskLevel: string): 'normal' | 'elevated' | 'urgent' {
  if (triggerType === 'action_failed' || riskLevel === 'critical') return 'urgent';
  if (triggerType === 'high_risk_action_waiting' || riskLevel === 'high' || triggerType === 'approval_reminder_needed') return 'elevated';
  return 'normal';
}

function reasonFor(triggerType: NotificationTriggerType, input: NotificationTriggerInput, ageMinutes: number): string {
  const title = cleanText(input.title, 120);
  const risk = cleanText(input.riskLevel.toLowerCase(), 40);
  if (triggerType === 'action_proposed') return `A new action is waiting for approval: ${title}.`;
  if (triggerType === 'action_failed') return cleanText(input.lastEventMessage || `The action failed and may need review: ${title}.`, 260);
  if (triggerType === 'high_risk_action_waiting') return `A ${risk}-risk action is waiting for founder approval.`;
  return `Approval reminder is due because this action has waited for ${ageMinutes} minutes.`;
}

function makeDecision(params: {
  triggerType: NotificationTriggerType;
  input: NotificationTriggerInput;
  ageMinutes: number;
  reminderDue: boolean;
  preferences: NotificationTriggerPreferencesSnapshot;
  now: Date;
}): NotificationTriggerDecision {
  const priority = priorityFor(params.triggerType, params.input.riskLevel.toLowerCase());
  const channelCandidates = {
    inAppCandidate: params.preferences.inAppEnabled,
    emailCandidate: params.preferences.emailEnabled,
    slackCandidate: false as const,
  };
  const quietHoursDelivery = enforceQuietHoursForNotification({
    actionId: params.input.actionId,
    workspaceId: params.input.workspaceId,
    title: params.input.title,
    actionType: params.input.actionType,
    riskLevel: params.input.riskLevel,
    priority,
    triggerType: params.triggerType,
    channels: channelCandidates,
  }, params.preferences, params.now);
  return {
    triggerType: params.triggerType,
    actionId: cleanText(params.input.actionId, 120),
    workspaceId: cleanText(params.input.workspaceId, 120),
    title: cleanText(params.input.title, 180),
    actionType: cleanText(params.input.actionType, 80),
    riskLevel: cleanText(params.input.riskLevel.toLowerCase(), 40),
    reason: reasonFor(params.triggerType, params.input, params.ageMinutes),
    reviewUrl: reviewUrlFor(params.input.actionId),
    priority,
    channels: channelCandidates,
    timing: {
      actionAgeMinutes: params.ageMinutes,
      reminderDue: params.reminderDue,
      reminderCount: Math.max(0, Math.floor(params.input.reminderCount || 0)),
      maxEscalations: params.preferences.maxEscalations,
      quietHoursMayDelayEmail: params.preferences.emailEnabled && params.preferences.quietHoursEnabled,
    },
    quietHoursDelivery: {
      quietHours: quietHoursDelivery.quietHours,
      critical: quietHoursDelivery.critical,
      channels: quietHoursDelivery.channels,
    },
    safety: {
      triggerOnly: true,
      createsNotificationRowsInThisPhase: false,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalServices: false,
      canApproveAction: false,
      canExecuteAction: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
    },
  };
}

export function evaluateNotificationTriggersForAction(
  input: NotificationTriggerInput,
  preferences: NotificationTriggerPreferencesSnapshot = defaultNotificationTriggerPreferences(),
  now: Date = new Date()
): NotificationTriggerDecision[] {
  const parsed = notificationTriggerInputSchema.parse(input);
  const safePreferences = notificationTriggerPreferencesSchema.parse(preferences);
  const status = parsed.status.toLowerCase();
  const riskLevel = parsed.riskLevel.toLowerCase();
  const createdAt = toDate(parsed.createdAt, now);
  const ageMinutes = minutesBetween(createdAt, now);
  const reminderCount = Math.max(0, Math.floor(parsed.reminderCount || 0));
  const reminderDue = parsed.approvalRequired
    && approvalStatuses.has(status)
    && reminderCount < safePreferences.maxEscalations
    && ageMinutes >= safePreferences.approvalEscalationMinutes;

  const decisions: NotificationTriggerDecision[] = [];
  const decisionBase = { input: parsed, ageMinutes, reminderDue, preferences: safePreferences, now };

  if (parsed.approvalRequired && approvalStatuses.has(status)) {
    decisions.push(makeDecision({ ...decisionBase, triggerType: 'action_proposed' }));
  }

  if (failureStatuses.has(status) || parsed.lastEventType === 'execution_failed' || parsed.lastEventType === 'rollback_failed') {
    decisions.push(makeDecision({ ...decisionBase, triggerType: 'action_failed' }));
  }

  if (parsed.approvalRequired && approvalStatuses.has(status) && highRiskLevels.has(riskLevel)) {
    decisions.push(makeDecision({ ...decisionBase, triggerType: 'high_risk_action_waiting' }));
  }

  if (reminderDue) {
    decisions.push(makeDecision({ ...decisionBase, triggerType: 'approval_reminder_needed' }));
  }

  assertNotificationTriggerDecisionsAreSafe(decisions);
  return decisions;
}

export function buildNotificationTriggerEvaluation(params: {
  workspaceId: string;
  candidates: NotificationTriggerInput[];
  preferences?: NotificationTriggerPreferencesSnapshot;
  now?: Date;
}): NotificationTriggerEvaluation {
  const now = params.now || new Date();
  const preferences = notificationTriggerPreferencesSchema.parse(params.preferences || defaultNotificationTriggerPreferences());
  const triggers = params.candidates.flatMap((candidate) => evaluateNotificationTriggersForAction(candidate, preferences, now));
  const countType = (type: NotificationTriggerType) => triggers.filter((trigger) => trigger.triggerType === type).length;
  const output: NotificationTriggerEvaluation = {
    version: NOTIFICATION_TRIGGERS_VERSION,
    phase: NOTIFICATION_TRIGGERS_PHASE,
    workspaceId: cleanText(params.workspaceId, 120),
    generatedAt: now.toISOString(),
    counts: {
      candidatesEvaluated: params.candidates.length,
      triggersCreated: triggers.length,
      actionProposed: countType('action_proposed'),
      actionFailed: countType('action_failed'),
      highRiskWaiting: countType('high_risk_action_waiting'),
      approvalRemindersNeeded: countType('approval_reminder_needed'),
    },
    triggers,
    preferencesSnapshot: preferences,
    safety: {
      triggerServiceOnly: true,
      createsNotificationRowsInThisPhase: false,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalServices: false,
      autoApprovalEnabled: false,
      autoExecutionEnabled: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
    },
  };
  assertNotificationTriggerEvaluationIsSafe(output);
  return output;
}

export function assertNotificationTriggerDecisionsAreSafe(decisions: NotificationTriggerDecision[]): void {
  const serialized = JSON.stringify(decisions).toLowerCase();
  const forbidden = ['access_token', 'refresh_token', 'authorization', 'bearer ', 'api_key', 'client_secret', 'database_url', 'password=', 'password:', 'raw_payload', 'payload_json', 'rollback_payload', 'encrypted_'];
  for (const fragment of forbidden) {
    if (serialized.includes(fragment)) {
      throw new Error(`Notification trigger output contains forbidden fragment: ${fragment}`);
    }
  }
  for (const decision of decisions) {
    if (!decision.safety.triggerOnly || decision.safety.sendsEmailInThisPhase || decision.safety.callsExternalServices || decision.safety.canApproveAction || decision.safety.canExecuteAction) {
      throw new Error('Notification trigger decision must remain trigger-only and non-executing.');
    }
  }
}

export function assertNotificationTriggerEvaluationIsSafe(output: NotificationTriggerEvaluation): void {
  assertNotificationTriggerDecisionsAreSafe(output.triggers);
  if (!output.safety.triggerServiceOnly || output.safety.sendsEmailInThisPhase || output.safety.sendsSlackInThisPhase || output.safety.callsExternalServices || output.safety.autoExecutionEnabled) {
    throw new Error('Phase 10.5 trigger evaluation must not deliver notifications or execute actions.');
  }
}
