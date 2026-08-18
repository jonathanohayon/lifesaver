import { z } from 'zod';
import { buildSecureApprovalReviewUrl } from './notification-secure-approval-links.model.js';
import { defaultNotificationTriggerPreferences } from './notification-triggers.model.js';
import { enforceQuietHoursForNotification } from './notification-quiet-hours.model.js';
import type { ApprovalReminderDecision, ApprovalReminderInput, ApprovalReminderPreferences, ApprovalReminderPreviewResponse } from './notification-approval-reminders.types.js';

export const APPROVAL_REMINDERS_VERSION = '0.7.0' as const;
export const APPROVAL_REMINDERS_PHASE = 'phase_10_6_reminder_escalation_logic' as const;

const approvalStatuses = new Set(['proposed', 'approval_required']);
const highRiskLevels = new Set(['high', 'critical']);
const forbiddenFragments = ['access_token', 'refresh_token', 'authorization', 'bearer ', 'api_key', 'client_secret', 'database_url', 'password=', 'password:', 'raw_payload', 'payload_json', 'rollback_payload', 'encrypted_'];

export const approvalReminderInputSchema = z.object({
  actionId: z.string().trim().min(1).max(120),
  workspaceId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(220),
  actionType: z.string().trim().min(1).max(80),
  status: z.string().trim().min(1).max(60),
  riskLevel: z.string().trim().min(1).max(40),
  approvalRequired: z.boolean(),
  createdAt: z.union([z.date(), z.string()]),
  lastReminderAt: z.union([z.date(), z.string(), z.null()]).optional(),
  reminderCount: z.number().int().min(0).max(1000).optional(),
}).strict();

export const approvalReminderPreferencesSchema = z.object({
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

function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60000).toISOString();
}

function cleanText(value: string, max: number): string {
  const clean = String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
  const lower = clean.toLowerCase();
  return forbiddenFragments.some((fragment) => lower.includes(fragment)) ? '[redacted unsafe text]' : clean;
}

function priorityFor(riskLevel: string, reminderCount: number): 'normal' | 'elevated' | 'urgent' {
  const risk = riskLevel.toLowerCase();
  if (risk === 'critical' || reminderCount >= 2) return 'urgent';
  if (risk === 'high' || reminderCount >= 1) return 'elevated';
  return 'normal';
}

export function defaultApprovalReminderPreferences(): ApprovalReminderPreferences {
  return approvalReminderPreferencesSchema.parse(defaultNotificationTriggerPreferences());
}

export function evaluateApprovalReminder(
  input: ApprovalReminderInput,
  preferences: ApprovalReminderPreferences = defaultApprovalReminderPreferences(),
  now: Date = new Date()
): ApprovalReminderDecision {
  const parsed = approvalReminderInputSchema.parse(input);
  const safePreferences = approvalReminderPreferencesSchema.parse(preferences);
  const status = parsed.status.toLowerCase();
  const riskLevel = parsed.riskLevel.toLowerCase();
  const createdAt = toDate(parsed.createdAt, now);
  const lastReminderAt = toDate(parsed.lastReminderAt || null, createdAt);
  const hasPreviousReminder = Boolean(parsed.lastReminderAt);
  const reminderCount = Math.max(0, Math.floor(parsed.reminderCount || 0));
  const eligible = parsed.approvalRequired && approvalStatuses.has(status) && reminderCount < safePreferences.maxEscalations;
  const dueAtIso = hasPreviousReminder
    ? addMinutes(lastReminderAt, safePreferences.repeatEscalationMinutes)
    : addMinutes(createdAt, safePreferences.approvalEscalationMinutes);
  const dueAt = new Date(dueAtIso);
  const reminderDue = eligible && now.getTime() >= dueAt.getTime();
  const actionAgeMinutes = minutesBetween(createdAt, now);
  const deepLink = buildSecureApprovalReviewUrl({ actionId: parsed.actionId, source: 'approval_reminder' });
  const reason = reminderDue
    ? `Approval reminder is due because this ${cleanText(parsed.actionType, 80)} action has waited ${actionAgeMinutes} minutes.`
    : eligible
      ? `Approval reminder is not due yet. Next reminder window opens at ${dueAtIso}.`
      : 'Approval reminder is not eligible for this action status, approval state, or escalation count.';
  const priority = highRiskLevels.has(riskLevel) && priorityFor(riskLevel, reminderCount) === 'normal' ? 'elevated' : priorityFor(riskLevel, reminderCount);
  const channelCandidates = {
    inAppCandidate: safePreferences.inAppEnabled,
    emailCandidate: safePreferences.emailEnabled,
    slackCandidate: false as const,
  };
  const quietHoursDelivery = enforceQuietHoursForNotification({
    actionId: parsed.actionId,
    workspaceId: parsed.workspaceId,
    title: parsed.title,
    actionType: parsed.actionType,
    riskLevel,
    priority,
    triggerType: 'approval_reminder_needed',
    channels: channelCandidates,
  }, safePreferences, now);

  const decision: ApprovalReminderDecision = {
    actionId: deepLink.actionId,
    workspaceId: cleanText(parsed.workspaceId, 120),
    title: cleanText(parsed.title, 180),
    actionType: cleanText(parsed.actionType, 80),
    riskLevel: cleanText(riskLevel, 40),
    status: cleanText(status, 60),
    reminderDue,
    reason,
    reviewUrl: deepLink.reviewUrl,
    priority,
    timing: {
      actionAgeMinutes,
      firstReminderAfterMinutes: safePreferences.approvalEscalationMinutes,
      repeatReminderAfterMinutes: safePreferences.repeatEscalationMinutes,
      reminderCount,
      maxEscalations: safePreferences.maxEscalations,
      lastReminderAt: hasPreviousReminder ? lastReminderAt.toISOString() : null,
      nextReminderAt: eligible ? dueAtIso : null,
    },
    channels: {
      inAppCandidate: channelCandidates.inAppCandidate,
      emailCandidate: channelCandidates.emailCandidate,
      slackCandidate: false,
      quietHoursMayDelayEmail: safePreferences.emailEnabled && safePreferences.quietHoursEnabled,
    },
    quietHoursDelivery: {
      quietHours: quietHoursDelivery.quietHours,
      critical: quietHoursDelivery.critical,
      channels: quietHoursDelivery.channels,
    },
    safety: {
      reminderPreviewOnly: true,
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
  assertSafeApprovalReminderDecision(decision);
  return decision;
}

export function buildApprovalReminderPreview(params: {
  workspaceId: string;
  candidates: ApprovalReminderInput[];
  preferences?: ApprovalReminderPreferences;
  now?: Date;
}): ApprovalReminderPreviewResponse {
  const now = params.now || new Date();
  const preferences = approvalReminderPreferencesSchema.parse(params.preferences || defaultApprovalReminderPreferences());
  const all = params.candidates.map((candidate) => evaluateApprovalReminder(candidate, preferences, now));
  const reminders = all.filter((decision) => decision.reminderDue);
  const response: ApprovalReminderPreviewResponse = {
    version: APPROVAL_REMINDERS_VERSION,
    phase: APPROVAL_REMINDERS_PHASE,
    workspaceId: cleanText(params.workspaceId, 120),
    generatedAt: now.toISOString(),
    counts: {
      candidatesEvaluated: params.candidates.length,
      remindersDue: reminders.length,
      urgent: reminders.filter((item) => item.priority === 'urgent').length,
      elevated: reminders.filter((item) => item.priority === 'elevated').length,
    },
    reminders,
    preferencesSnapshot: preferences,
    safety: {
      reminderSystemOnly: true,
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
  assertSafeApprovalReminderPreview(response);
  return response;
}

export function assertSafeApprovalReminderDecision(decision: ApprovalReminderDecision): void {
  const serialized = JSON.stringify(decision).toLowerCase();
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) throw new Error(`Approval reminder output contains forbidden fragment: ${fragment}`);
  }
  if (!decision.safety.reminderPreviewOnly || decision.safety.sendsEmailInThisPhase || decision.safety.callsExternalServices || decision.safety.canApproveAction || decision.safety.canExecuteAction) {
    throw new Error('Approval reminder decisions must remain preview-only and non-executing.');
  }
}

export function assertSafeApprovalReminderPreview(response: ApprovalReminderPreviewResponse): void {
  response.reminders.forEach(assertSafeApprovalReminderDecision);
  if (!response.safety.reminderSystemOnly || response.safety.sendsEmailInThisPhase || response.safety.sendsSlackInThisPhase || response.safety.callsExternalServices || response.safety.autoExecutionEnabled) {
    throw new Error('Approval reminder preview must not deliver notifications or execute actions.');
  }
}
