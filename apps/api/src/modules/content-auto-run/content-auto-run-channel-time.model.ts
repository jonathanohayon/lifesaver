import type {
  ContentAutoRunAllowedDay,
  ContentAutoRunAllowedWindow,
  ContentAutoRunChannelTimeInput,
  ContentAutoRunChannelTimeResult,
  ContentAutoRunChannelTimeStatus,
} from './content-auto-run-channel-time.types.js';

export const CONTENT_AUTO_RUN_CHANNEL_TIME_PHASE = 'phase_11_4_allowed_channels_times' as const;
export const CONTENT_AUTO_RUN_CHANNEL_TIME_HEALTH_MODE = 'v2-phase-11-4-allowed-channels-times' as const;
export const CONTENT_AUTO_RUN_DEFAULT_ALLOWED_PLATFORMS = ['linkedin'] as const;
export const CONTENT_AUTO_RUN_DEFAULT_ALLOWED_CHANNELS = ['linkedin_member_feed'] as const;
export const CONTENT_AUTO_RUN_DEFAULT_ALLOWED_WINDOWS: ContentAutoRunAllowedWindow[] = [
  { label: 'default_business_hours', startTime: '09:00', endTime: '18:00', days: ['all'] },
];

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'payload_json',
  'raw_payload',
  'rollback_payload',
  'encrypted_',
];

function normalizeStringList(values: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(values)) return [...fallback];
  const cleaned = values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
  return cleaned.length ? Array.from(new Set(cleaned)) : [...fallback];
}

function normalizeTimezone(value: unknown): string {
  const timezone = String(value || '').trim();
  if (!timezone || timezone.length > 80) return 'UTC';
  return timezone;
}

function normalizeClock(value: unknown): string | null {
  const raw = String(value || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toMinutes(clock: string): number {
  const [hour, minute] = clock.split(':').map(Number);
  return (hour * 60) + minute;
}

function normalizeDay(value: unknown): ContentAutoRunAllowedDay | null {
  const normalized = String(value || '').trim().toLowerCase().slice(0, 3);
  if (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(normalized)) return normalized as ContentAutoRunAllowedDay;
  if (String(value || '').trim().toLowerCase() === 'all') return 'all';
  return null;
}

function normalizeDays(values: unknown): ContentAutoRunAllowedDay[] {
  if (!Array.isArray(values)) return ['all'];
  const days = values.map(normalizeDay).filter((value): value is ContentAutoRunAllowedDay => Boolean(value));
  return days.length ? Array.from(new Set(days)) : ['all'];
}

function normalizeAllowedWindows(values: unknown): ContentAutoRunAllowedWindow[] {
  if (!Array.isArray(values)) return CONTENT_AUTO_RUN_DEFAULT_ALLOWED_WINDOWS.map((window) => ({ ...window, days: [...(window.days || ['all'])] }));

  const windows = values.slice(0, 10).map((window, index) => {
    const candidate = (typeof window === 'object' && window !== null) ? window as Record<string, unknown> : {};
    const startTime = normalizeClock(candidate.startTime);
    const endTime = normalizeClock(candidate.endTime);
    return {
      label: String(candidate.label || `allowed_window_${index + 1}`).slice(0, 80),
      startTime: startTime || 'invalid',
      endTime: endTime || 'invalid',
      days: normalizeDays(candidate.days),
    };
  });

  return windows.length ? windows : CONTENT_AUTO_RUN_DEFAULT_ALLOWED_WINDOWS.map((window) => ({ ...window, days: [...(window.days || ['all'])] }));
}

function getReferenceDate(input: ContentAutoRunChannelTimeInput): Date {
  const raw = input.scheduledTime || input.currentTime || new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function formatInTimezone(date: Date, timezone: string): { localTime: string; localDay: ContentAutoRunAllowedDay } {
  try {
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const dayText = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(date).toLowerCase();
    const hour = timeParts.find((part) => part.type === 'hour')?.value || '00';
    const minute = timeParts.find((part) => part.type === 'minute')?.value || '00';
    return {
      localTime: `${hour}:${minute}`,
      localDay: normalizeDay(dayText) || 'mon',
    };
  } catch {
    return formatInTimezone(date, 'UTC');
  }
}

function daysInclude(window: ContentAutoRunAllowedWindow, day: ContentAutoRunAllowedDay): boolean {
  const days = window.days || ['all'];
  return days.includes('all') || days.includes(day);
}

function isWithinClockWindow(localTime: string, window: ContentAutoRunAllowedWindow): boolean {
  const start = normalizeClock(window.startTime);
  const end = normalizeClock(window.endTime);
  if (!start || !end) return false;
  const currentMinutes = toMinutes(localTime);
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Cross-midnight window, for example 22:00 -> 02:00.
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function findMatchedWindow(localTime: string, localDay: ContentAutoRunAllowedDay, windows: ContentAutoRunAllowedWindow[]): ContentAutoRunAllowedWindow | null {
  for (const window of windows) {
    if (!daysInclude(window, localDay)) continue;
    if (isWithinClockWindow(localTime, window)) return window;
  }
  return null;
}

export function buildContentAutoRunChannelTimeSafety(): ContentAutoRunChannelTimeResult['safety'] {
  return {
    restrictionCheckOnly: true,
    autoRunEnabled: false,
    autoApprovalEnabled: false,
    doesNotPublish: true,
    externalApiCalled: false,
    manualApprovalStillRequired: true,
    noDatabaseWrites: true,
    futureAutoRunRequiresAdditionalGates: true,
  };
}

export function checkContentAutoRunChannelTimeRestrictions(input: ContentAutoRunChannelTimeInput = {}): ContentAutoRunChannelTimeResult {
  const platform = String(input.platform || 'linkedin').trim().toLowerCase();
  const channel = String(input.channel || 'linkedin_member_feed').trim().toLowerCase();
  const actionType = String(input.actionType || 'content_publish').trim().toLowerCase();
  const timezone = normalizeTimezone(input.timezone);
  const referenceDate = getReferenceDate(input);
  const { localTime, localDay } = formatInTimezone(referenceDate, timezone);
  const allowedPlatforms = normalizeStringList(input.allowedPlatforms, CONTENT_AUTO_RUN_DEFAULT_ALLOWED_PLATFORMS);
  const allowedChannels = normalizeStringList(input.allowedChannels, CONTENT_AUTO_RUN_DEFAULT_ALLOWED_CHANNELS);
  const allowedWindows = normalizeAllowedWindows(input.allowedWindows);

  const platformAllowed = allowedPlatforms.includes(platform);
  const channelAllowed = allowedChannels.includes(channel);
  const hasInvalidWindow = allowedWindows.some((window) => !normalizeClock(window.startTime) || !normalizeClock(window.endTime) || normalizeClock(window.startTime) === normalizeClock(window.endTime));
  const matchedWindow = hasInvalidWindow ? null : findMatchedWindow(localTime, localDay, allowedWindows);
  const withinAllowedWindow = Boolean(matchedWindow);

  let decision: ContentAutoRunChannelTimeResult['decision'] = 'allowed_for_future_auto_run_review';
  let reason = 'Platform, channel, and local time are within the configured future auto-run restrictions.';

  if (actionType !== 'content_publish') {
    decision = 'blocked_invalid_action_type';
    reason = 'Phase 11.4 channel/time restriction check only supports content_publish actions.';
  } else if (hasInvalidWindow) {
    decision = 'blocked_invalid_time_window';
    reason = 'One or more allowed time windows are invalid or have identical start/end times.';
  } else if (!platformAllowed) {
    decision = 'blocked_platform_not_allowed';
    reason = 'The requested platform is not allowed for the future narrow content auto-run lane.';
  } else if (!channelAllowed) {
    decision = 'blocked_channel_not_allowed';
    reason = 'The requested channel is not allowed for the future narrow content auto-run lane.';
  } else if (!withinAllowedWindow) {
    decision = 'blocked_outside_time_window';
    reason = 'The requested publish time is outside configured allowed publishing windows.';
  }

  const restrictionsSatisfied = decision === 'allowed_for_future_auto_run_review';

  return {
    phase: CONTENT_AUTO_RUN_CHANNEL_TIME_PHASE,
    healthMode: CONTENT_AUTO_RUN_CHANNEL_TIME_HEALTH_MODE,
    deliverable: 'channel_time_restrictions',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    actionType: 'content_publish',
    timezone,
    referenceTime: referenceDate.toISOString(),
    localTime,
    localDay,
    allowedPlatforms,
    allowedChannels,
    allowedWindows,
    matchedWindow,
    platformAllowed,
    channelAllowed,
    withinAllowedWindow,
    restrictionsSatisfied,
    decision,
    reason,
    autoRunAllowedNow: false,
    safety: buildContentAutoRunChannelTimeSafety(),
  };
}

export function buildContentAutoRunChannelTimeStatus(): ContentAutoRunChannelTimeStatus {
  return {
    phase: CONTENT_AUTO_RUN_CHANNEL_TIME_PHASE,
    healthMode: CONTENT_AUTO_RUN_CHANNEL_TIME_HEALTH_MODE,
    enabled: true,
    deliverable: 'channel_time_restrictions',
    supportedPlatform: 'linkedin',
    supportedChannel: 'linkedin_member_feed',
    supportedActionType: 'content_publish',
    defaultTimezone: 'UTC',
    defaultAllowedPlatforms: [...CONTENT_AUTO_RUN_DEFAULT_ALLOWED_PLATFORMS],
    defaultAllowedChannels: [...CONTENT_AUTO_RUN_DEFAULT_ALLOWED_CHANNELS],
    defaultAllowedWindows: CONTENT_AUTO_RUN_DEFAULT_ALLOWED_WINDOWS.map((window) => ({ ...window, days: [...(window.days || ['all'])] })),
    safety: buildContentAutoRunChannelTimeSafety(),
  };
}

export function assertContentAutoRunChannelTimeSafe(result: ContentAutoRunChannelTimeResult): void {
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Channel/time restriction output contains forbidden fragment: ${forbidden}`);
    }
  }

  if (!result.safety.restrictionCheckOnly || result.safety.autoRunEnabled || result.safety.autoApprovalEnabled || !result.safety.manualApprovalStillRequired || result.autoRunAllowedNow) {
    throw new Error('Channel/time restriction safety flags are invalid for Phase 11.4.');
  }
}
