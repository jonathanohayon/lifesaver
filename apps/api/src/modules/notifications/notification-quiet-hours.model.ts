import { z } from 'zod';
import { DEFAULT_NOTIFICATION_PREFERENCES_ROW } from './notification-preferences.model.js';
import type {
  QuietHoursChannelDecision,
  QuietHoursEnforcementDecision,
  QuietHoursEnforcementInput,
  QuietHoursPreferencesSnapshot,
  QuietHoursPreviewResponse,
} from './notification-quiet-hours.types.js';

export const QUIET_HOURS_VERSION = '0.7.0' as const;
export const QUIET_HOURS_PHASE = 'phase_10_7_quiet_hours_enforcement' as const;

const hhmmRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const forbiddenFragments = ['access_token', 'refresh_token', 'authorization', 'bearer ', 'api_key', 'client_secret', 'database_url', 'password=', 'password:', 'raw_payload', 'payload_json', 'rollback_payload', 'encrypted_'];

export const quietHoursPreferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  slackEnabled: z.literal(false),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(hhmmRegex),
  quietHoursEnd: z.string().regex(hhmmRegex),
  quietHoursTimezone: z.string().trim().min(3).max(80),
}).passthrough();

export const quietHoursEnforcementInputSchema = z.object({
  actionId: z.string().trim().min(1).max(120),
  workspaceId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(220),
  actionType: z.string().trim().min(1).max(80),
  riskLevel: z.string().trim().min(1).max(40),
  priority: z.enum(['normal', 'elevated', 'urgent']),
  triggerType: z.enum(['action_proposed', 'action_failed', 'high_risk_action_waiting', 'approval_reminder_needed', 'manual_preview']),
  channels: z.object({
    inAppCandidate: z.boolean(),
    emailCandidate: z.boolean(),
    slackCandidate: z.literal(false),
  }).strict(),
}).strict();

function cleanText(value: string, max: number): string {
  const clean = String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
  const lower = clean.toLowerCase();
  return forbiddenFragments.some((fragment) => lower.includes(fragment)) ? '[redacted unsafe text]' : clean;
}

export function parseQuietHoursHhmm(value: string): number {
  if (!hhmmRegex.test(value)) throw new Error(`Invalid quiet-hours time: ${value}`);
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

export function quietHoursCrossesMidnight(start: string, end: string): boolean {
  return parseQuietHoursHhmm(start) > parseQuietHoursHhmm(end);
}

function getLocalHhmm(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value || '00';
  const minute = parts.find((part) => part.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

export function isQuietHoursActiveAt(preferences: QuietHoursPreferencesSnapshot, now: Date = new Date()): boolean {
  const safePreferences = quietHoursPreferencesSchema.parse(preferences);
  if (!safePreferences.quietHoursEnabled) return false;
  const start = parseQuietHoursHhmm(safePreferences.quietHoursStart);
  const end = parseQuietHoursHhmm(safePreferences.quietHoursEnd);
  if (start === end) return false;
  const localMinutes = parseQuietHoursHhmm(getLocalHhmm(now, safePreferences.quietHoursTimezone));
  return start < end ? localMinutes >= start && localMinutes < end : localMinutes >= start || localMinutes < end;
}

export function findQuietHoursNextOpenAt(preferences: QuietHoursPreferencesSnapshot, now: Date = new Date()): string | null {
  const safePreferences = quietHoursPreferencesSchema.parse(preferences);
  if (!isQuietHoursActiveAt(safePreferences, now)) return null;
  for (let minuteOffset = 1; minuteOffset <= 24 * 60 + 5; minuteOffset += 1) {
    const candidate = new Date(now.getTime() + minuteOffset * 60000);
    if (!isQuietHoursActiveAt(safePreferences, candidate)) return candidate.toISOString();
  }
  return null;
}

export function defaultQuietHoursPreferences(): QuietHoursPreferencesSnapshot {
  return quietHoursPreferencesSchema.parse({
    inAppEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.in_app_enabled,
    emailEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.email_enabled,
    slackEnabled: false,
    quietHoursEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_enabled,
    quietHoursStart: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_start,
    quietHoursEnd: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_end,
    quietHoursTimezone: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_timezone,
  });
}

function criticalReason(input: QuietHoursEnforcementInput): string {
  const risk = input.riskLevel.toLowerCase();
  if (input.triggerType === 'action_failed') return 'Action failure notification is treated as critical.';
  if (input.priority === 'urgent') return 'Urgent notification priority bypasses quiet hours.';
  if (risk === 'critical') return 'Critical risk level bypasses quiet hours.';
  return 'Notification is not critical and may be delayed during quiet hours.';
}

function isCritical(input: QuietHoursEnforcementInput): boolean {
  return input.triggerType === 'action_failed' || input.priority === 'urgent' || input.riskLevel.toLowerCase() === 'critical';
}

function channelDecision(params: {
  channel: QuietHoursChannelDecision['channel'];
  candidate: boolean;
  quietActive: boolean;
  quietEnabled: boolean;
  critical: boolean;
  nextOpenAt: string | null;
}): QuietHoursChannelDecision {
  if (!params.candidate) {
    return {
      channel: params.channel,
      candidate: false,
      allowedNow: false,
      delayed: false,
      delayedUntil: null,
      criticalOverride: false,
      reason: `${params.channel} is not enabled or not a candidate channel.`,
    };
  }
  if (!params.quietEnabled || !params.quietActive) {
    return {
      channel: params.channel,
      candidate: true,
      allowedNow: true,
      delayed: false,
      delayedUntil: null,
      criticalOverride: false,
      reason: 'Quiet hours are not active, so this channel may be used by a later delivery phase.',
    };
  }
  if (params.critical) {
    return {
      channel: params.channel,
      candidate: true,
      allowedNow: true,
      delayed: false,
      delayedUntil: null,
      criticalOverride: true,
      reason: 'Critical notification may bypass quiet hours.',
    };
  }
  return {
    channel: params.channel,
    candidate: true,
    allowedNow: false,
    delayed: true,
    delayedUntil: params.nextOpenAt,
    criticalOverride: false,
    reason: 'Quiet hours are active, so non-critical notification delivery should be delayed.',
  };
}

export function enforceQuietHoursForNotification(
  input: QuietHoursEnforcementInput,
  preferences: QuietHoursPreferencesSnapshot = defaultQuietHoursPreferences(),
  now: Date = new Date()
): QuietHoursEnforcementDecision {
  const parsed = quietHoursEnforcementInputSchema.parse(input);
  const safePreferences = quietHoursPreferencesSchema.parse(preferences);
  const quietActive = isQuietHoursActiveAt(safePreferences, now);
  const nextOpenAt = quietActive ? findQuietHoursNextOpenAt(safePreferences, now) : null;
  const critical = isCritical(parsed);
  const quietEnabled = safePreferences.quietHoursEnabled;
  const localTime = getLocalHhmm(now, safePreferences.quietHoursTimezone);
  const decision: QuietHoursEnforcementDecision = {
    version: QUIET_HOURS_VERSION,
    phase: QUIET_HOURS_PHASE,
    actionId: cleanText(parsed.actionId, 120),
    workspaceId: cleanText(parsed.workspaceId, 120),
    title: cleanText(parsed.title, 180),
    actionType: cleanText(parsed.actionType, 80),
    riskLevel: cleanText(parsed.riskLevel.toLowerCase(), 40),
    priority: parsed.priority,
    triggerType: parsed.triggerType,
    generatedAt: now.toISOString(),
    quietHours: {
      enabled: quietEnabled,
      activeNow: quietActive,
      timezone: safePreferences.quietHoursTimezone,
      start: safePreferences.quietHoursStart,
      end: safePreferences.quietHoursEnd,
      crossesMidnight: quietHoursCrossesMidnight(safePreferences.quietHoursStart, safePreferences.quietHoursEnd),
      localTime,
      nextOpenAt,
    },
    critical: {
      isCritical: critical,
      reason: criticalReason(parsed),
    },
    channels: {
      inApp: channelDecision({ channel: 'in_app', candidate: parsed.channels.inAppCandidate && safePreferences.inAppEnabled, quietActive, quietEnabled, critical, nextOpenAt }),
      email: channelDecision({ channel: 'email', candidate: parsed.channels.emailCandidate && safePreferences.emailEnabled, quietActive, quietEnabled, critical, nextOpenAt }),
      slack: channelDecision({ channel: 'slack', candidate: false, quietActive, quietEnabled, critical, nextOpenAt }),
    },
    safety: {
      quietHoursEnforcementOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      createsNotificationRowsInThisPhase: false,
      callsExternalServices: false,
      canApproveAction: false,
      canExecuteAction: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
    },
  };
  assertQuietHoursDecisionIsSafe(decision);
  return decision;
}

export function buildQuietHoursPreview(params: {
  workspaceId: string;
  candidates: QuietHoursEnforcementInput[];
  preferences?: QuietHoursPreferencesSnapshot;
  now?: Date;
}): QuietHoursPreviewResponse {
  const now = params.now || new Date();
  const preferences = quietHoursPreferencesSchema.parse(params.preferences || defaultQuietHoursPreferences());
  const decisions = params.candidates.map((candidate) => enforceQuietHoursForNotification(candidate, preferences, now));
  const delayedByQuietHours = decisions.filter((decision) => decision.channels.email.delayed || decision.channels.inApp.delayed).length;
  const criticalOverrides = decisions.filter((decision) => decision.channels.email.criticalOverride || decision.channels.inApp.criticalOverride).length;
  const allowedNow = decisions.filter((decision) => decision.channels.email.allowedNow || decision.channels.inApp.allowedNow).length;
  const response: QuietHoursPreviewResponse = {
    version: QUIET_HOURS_VERSION,
    phase: QUIET_HOURS_PHASE,
    workspaceId: cleanText(params.workspaceId, 120),
    generatedAt: now.toISOString(),
    counts: {
      candidatesEvaluated: params.candidates.length,
      delayedByQuietHours,
      criticalOverrides,
      allowedNow,
    },
    decisions,
    preferencesSnapshot: preferences,
    safety: {
      quietHoursEnforcementOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      createsNotificationRowsInThisPhase: false,
      callsExternalServices: false,
      autoApprovalEnabled: false,
      autoExecutionEnabled: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
    },
  };
  assertQuietHoursPreviewIsSafe(response);
  return response;
}

export function assertQuietHoursDecisionIsSafe(decision: QuietHoursEnforcementDecision): void {
  const serialized = JSON.stringify(decision).toLowerCase();
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) throw new Error(`Quiet-hours decision contains forbidden fragment: ${fragment}`);
  }
  if (!decision.safety.quietHoursEnforcementOnly || decision.safety.sendsEmailInThisPhase || decision.safety.callsExternalServices || decision.safety.canApproveAction || decision.safety.canExecuteAction) {
    throw new Error('Quiet-hours decision must remain enforcement-only and non-executing.');
  }
}

export function assertQuietHoursPreviewIsSafe(response: QuietHoursPreviewResponse): void {
  response.decisions.forEach(assertQuietHoursDecisionIsSafe);
  if (!response.safety.quietHoursEnforcementOnly || response.safety.sendsEmailInThisPhase || response.safety.sendsSlackInThisPhase || response.safety.callsExternalServices || response.safety.autoExecutionEnabled) {
    throw new Error('Quiet-hours preview must not deliver notifications or execute actions.');
  }
}
