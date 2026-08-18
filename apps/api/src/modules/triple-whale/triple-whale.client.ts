import { env } from '../../config/env.js';

export type TripleWhaleSummaryRequestMode =
  | 'env_json_override'
  | 'captured_period_and_periods'
  | 'captured_period_only'
  | 'captured_period_with_comparison_period'
  | 'captured_period_string_today'
  | 'not_configured';

export type TripleWhaleClientVerification = {
  liveVerificationEnabled: boolean;
  reason: string;
  validateUrl: string;
  summaryProbeConfigured: boolean;
  summaryRequestMode: TripleWhaleSummaryRequestMode | 'captured_probe_variants';
};

export type TripleWhaleApiKeyValidationResult = {
  ok: boolean;
  httpStatus: number | null;
  contentType: string | null;
  responseKind: 'json' | 'text' | 'empty';
  responsePreview: unknown;
  message: string;
};

export type TripleWhaleSummaryProbeAttempt = {
  mode: TripleWhaleSummaryRequestMode;
  ok: boolean;
  httpStatus: number | null;
  contentType: string | null;
  responseKind: 'json' | 'text' | 'empty' | 'not_configured';
  message: string;
  requestBody: Record<string, unknown> | null;
  responsePreview: unknown;
};

export type TripleWhaleSummaryProbeResult = {
  attempted: boolean;
  ok: boolean;
  httpStatus: number | null;
  contentType: string | null;
  responseKind: 'json' | 'text' | 'empty' | 'not_configured';
  rawPayload: Record<string, unknown> | null;
  responsePreview: unknown;
  requestBody: Record<string, unknown> | null;
  requestMode: TripleWhaleSummaryRequestMode;
  dateRange: string | null;
  attempts: TripleWhaleSummaryProbeAttempt[];
  message: string;
};

export type TripleWhaleAttributionRequestMode =
  | 'env_json_override'
  | 'captured_customer_journey_v2'
  | 'not_configured';

export type TripleWhaleAttributionProbeAttempt = {
  mode: TripleWhaleAttributionRequestMode;
  ok: boolean;
  httpStatus: number | null;
  contentType: string | null;
  responseKind: 'json' | 'text' | 'empty' | 'not_configured';
  message: string;
  requestBody: Record<string, unknown> | null;
  responsePreview: unknown;
};

export type TripleWhaleAttributionProbeResult = {
  attempted: boolean;
  ok: boolean;
  httpStatus: number | null;
  contentType: string | null;
  responseKind: 'json' | 'text' | 'empty' | 'not_configured';
  rawPayload: Record<string, unknown> | null;
  responsePreview: unknown;
  requestBody: Record<string, unknown> | null;
  requestMode: TripleWhaleAttributionRequestMode;
  dateRange: string | null;
  attempts: TripleWhaleAttributionProbeAttempt[];
  message: string;
};

type ConfiguredSummaryBody = {
  body: Record<string, unknown>;
  mode: Exclude<TripleWhaleSummaryRequestMode, 'not_configured'>;
  dateRange: string;
};

function buildUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${env.TRIPLE_WHALE_API_BASE_URL.replace(/\/$/, '')}/${pathOrUrl.replace(/^\//, '')}`;
}

function previewText(text: string): string {
  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
}

function safeJsonPreview(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (text.length <= 2000) return value;
  return { preview: `${text.slice(0, 2000)}…`, truncated: true };
}

async function readBoundedResponse(response: Response): Promise<{
  contentType: string | null;
  responseKind: 'json' | 'text' | 'empty';
  preview: unknown;
  jsonPayload: Record<string, unknown> | null;
}> {
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  if (!text) {
    return { contentType, responseKind: 'empty', preview: null, jsonPayload: null };
  }

  if (contentType && contentType.toLowerCase().includes('application/json')) {
    try {
      const json = JSON.parse(text);
      return {
        contentType,
        responseKind: 'json',
        preview: safeJsonPreview(json),
        jsonPayload: json && typeof json === 'object' && !Array.isArray(json) ? json as Record<string, unknown> : { data: json },
      };
    } catch (_error) {
      // Fall through to text preview.
    }
  }

  return { contentType, responseKind: 'text', preview: previewText(text), jsonPayload: null };
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function getDateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function getHourInTimezone(timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find(p => p.type === 'hour')?.value || '0');
  return Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 0;
}

function subtractOneDay(dateYYYYMMDD: string): string {
  const [year, month, day] = dateYYYYMMDD.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseAdditionalShopIds(): string[] {
  const raw = env.TRIPLE_WHALE_ADDITIONAL_SHOP_IDS || env.TRIPLE_WHALE_SHOP_DOMAIN;
  const ids = raw.split(',').map((v: string) => v.trim()).filter(Boolean);
  return ids.length ? ids : [env.TRIPLE_WHALE_SHOP_DOMAIN];
}

function buildCapturedSummaryCommon() {
  const shopDomain = env.TRIPLE_WHALE_SHOP_DOMAIN?.trim();
  if (!shopDomain) return null;

  const timezone = env.TRIPLE_WHALE_TIMEZONE || 'America/New_York';
  const offset = env.TRIPLE_WHALE_TIMEZONE_OFFSET || '-04:00';
  const selectedDate = env.TRIPLE_WHALE_SUMMARY_DATE?.trim() || getDateInTimezone(timezone);
  const previousDate = subtractOneDay(selectedDate);
  const start = `${selectedDate}T00:00:00${offset}`;
  const end = `${selectedDate}T23:59:59${offset}`;
  const previousStart = `${previousDate}T00:00:00${offset}`;
  const previousEnd = `${previousDate}T23:59:59${offset}`;
  const todayHour = env.TRIPLE_WHALE_TODAY_HOUR ? Number(env.TRIPLE_WHALE_TODAY_HOUR) : getHourInTimezone(timezone);

  const period = { start, end };
  const comparisonPeriod = { start: previousStart, end: previousEnd };
  const periods = [period, comparisonPeriod];
  const common = {
    todayHour: Number.isFinite(todayHour) ? Math.max(0, Math.min(23, todayHour)) : 0,
    todayHourSubtractForPrevPeriod: true,
    shopDomain,
    key: `${start}${end}`,
    includeCalculatedStats: true,
    includeRawStats: true,
    includeCharts: true,
    groupStatsBy: env.TRIPLE_WHALE_SUMMARY_GROUP_BY || 'hour',
    activeOrderSegment: [],
    additionalShopIds: parseAdditionalShopIds(),
    currency: env.TRIPLE_WHALE_CURRENCY || 'USD',
  };

  return { common, period, comparisonPeriod, periods, selectedDate, previousDate };
}

export function buildCapturedTripleWhaleSummaryBody(): { body: Record<string, unknown>; dateRange: string } | null {
  const variants = buildConfiguredSummaryBodies();
  const firstDynamic = variants.find(v => v.mode !== 'env_json_override');
  return firstDynamic ? { body: firstDynamic.body, dateRange: firstDynamic.dateRange } : null;
}

function buildConfiguredSummaryBodies(): ConfiguredSummaryBody[] {
  const bodyText = env.TRIPLE_WHALE_SUMMARY_BODY_JSON?.trim();
  if (bodyText) {
    const parsed = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('TRIPLE_WHALE_SUMMARY_BODY_JSON must be a JSON object.');
    }
    return [{ body: parsed as Record<string, unknown>, mode: 'env_json_override', dateRange: 'env_json_summary_body' }];
  }

  const captured = buildCapturedSummaryCommon();
  if (!captured) return [];

  const { common, period, comparisonPeriod, periods, selectedDate, previousDate } = captured;
  const dateRange = `${selectedDate}_vs_${previousDate}`;

  // v0.3.0: Triple Whale returned "period must be specified" when only `periods` was sent.
  // These read-only probe variants add a top-level `period` in controlled shapes so we can identify the accepted body.
  return [
    {
      mode: 'captured_period_and_periods',
      dateRange,
      body: {
        period,
        periods,
        ...common,
      },
    },
    {
      mode: 'captured_period_with_comparison_period',
      dateRange,
      body: {
        period,
        comparisonPeriod,
        ...common,
      },
    },
    {
      mode: 'captured_period_only',
      dateRange,
      body: {
        period,
        ...common,
      },
    },
    {
      mode: 'captured_period_string_today',
      dateRange,
      body: {
        period: 'today',
        periods,
        ...common,
      },
    },
  ];
}


type ConfiguredAttributionBody = {
  body: Record<string, unknown>;
  mode: Exclude<TripleWhaleAttributionRequestMode, 'not_configured'>;
  dateRange: string;
};

function buildConfiguredAttributionBodies(): ConfiguredAttributionBody[] {
  const bodyText = env.TRIPLE_WHALE_ATTRIBUTION_BODY_JSON?.trim();
  if (bodyText) {
    const parsed = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('TRIPLE_WHALE_ATTRIBUTION_BODY_JSON must be a JSON object.');
    }
    return [{ body: parsed as Record<string, unknown>, mode: 'env_json_override', dateRange: 'env_json_attribution_body' }];
  }

  const shop = env.TRIPLE_WHALE_SHOP_DOMAIN?.trim();
  if (!shop) return [];

  const timezone = env.TRIPLE_WHALE_TIMEZONE || 'America/New_York';
  const selectedDate = env.TRIPLE_WHALE_ATTRIBUTION_DATE?.trim() || env.TRIPLE_WHALE_SUMMARY_DATE?.trim() || getDateInTimezone(timezone);
  const page = Math.max(1, Math.min(10000, Number(env.TRIPLE_WHALE_ATTRIBUTION_PAGE) || 1));
  const pageSize = Math.max(1, Math.min(100, Number(env.TRIPLE_WHALE_ATTRIBUTION_PAGE_SIZE) || 25));

  return [{
    mode: 'captured_customer_journey_v2',
    dateRange: selectedDate,
    body: {
      shop,
      startDate: selectedDate,
      endDate: selectedDate,
      page,
      pageSize,
      excludeJourneyData: Boolean(env.TRIPLE_WHALE_ATTRIBUTION_EXCLUDE_JOURNEY_DATA),
    },
  }];
}

export function getTripleWhaleClientVerificationStatus(): TripleWhaleClientVerification {
  const validateUrl = buildUrl(env.TRIPLE_WHALE_VALIDATE_PATH);
  let summaryRequestMode: TripleWhaleClientVerification['summaryRequestMode'] = 'not_configured';
  try {
    const configured = buildConfiguredSummaryBodies();
    if (configured.length === 1) summaryRequestMode = configured[0].mode;
    if (configured.length > 1) summaryRequestMode = 'captured_probe_variants';
  } catch (_error) {
    summaryRequestMode = 'not_configured';
  }
  const summaryProbeConfigured = summaryRequestMode !== 'not_configured';
  return {
    liveVerificationEnabled: true,
    validateUrl,
    summaryProbeConfigured,
    summaryRequestMode,
    reason: summaryProbeConfigured
      ? `Triple Whale API key validation is enabled, and Summary Page probe uses ${summaryRequestMode}.`
      : 'Triple Whale API key validation is enabled. Summary Page data pull requires shop/timezone/currency configuration or JSON override.',
  };
}

export async function validateTripleWhaleApiKey(apiKey: string): Promise<TripleWhaleApiKeyValidationResult> {
  const url = buildUrl(env.TRIPLE_WHALE_VALIDATE_PATH);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'accept': 'application/json',
      'user-agent': 'LIFE.SAVER-v0.5.2-dev',
    },
  });

  const parsed = await readBoundedResponse(response);
  return {
    ok: response.ok,
    httpStatus: response.status,
    contentType: parsed.contentType,
    responseKind: parsed.responseKind,
    responsePreview: parsed.preview,
    message: response.ok
      ? 'Triple Whale API key validated successfully through the official API key endpoint.'
      : 'Triple Whale API key validation returned an error response. Check key scopes, account access, or whether the key was copied correctly.',
  };
}

async function postSummaryProbeAttempt(apiKey: string, configured: ConfiguredSummaryBody): Promise<{
  attempt: TripleWhaleSummaryProbeAttempt;
  rawPayload: Record<string, unknown> | null;
}> {
  const url = buildUrl(env.TRIPLE_WHALE_SUMMARY_PATH);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': 'LIFE.SAVER-v0.5.2-dev',
    },
    body: JSON.stringify(configured.body),
  });

  const parsed = await readBoundedResponse(response);
  const attempt: TripleWhaleSummaryProbeAttempt = {
    mode: configured.mode,
    ok: response.ok,
    httpStatus: response.status,
    contentType: parsed.contentType,
    responseKind: parsed.responseKind,
    message: response.ok
      ? `Triple Whale Summary Page probe returned successfully using ${configured.mode}.`
      : `Triple Whale Summary Page probe returned ${response.status} using ${configured.mode}.`,
    requestBody: configured.body,
    responsePreview: parsed.preview,
  };

  return { attempt, rawPayload: parsed.jsonPayload };
}

export async function fetchTripleWhaleSummaryProbe(apiKey: string): Promise<TripleWhaleSummaryProbeResult> {
  let configuredBodies: ConfiguredSummaryBody[];
  try {
    configuredBodies = buildConfiguredSummaryBodies();
  } catch (error: any) {
    return {
      attempted: false,
      ok: false,
      httpStatus: null,
      contentType: null,
      responseKind: 'not_configured',
      rawPayload: null,
      responsePreview: null,
      requestBody: null,
      requestMode: 'not_configured',
      dateRange: null,
      attempts: [],
      message: error?.message || 'Triple Whale Summary request body configuration is invalid.',
    };
  }

  if (!configuredBodies.length) {
    return {
      attempted: false,
      ok: false,
      httpStatus: null,
      contentType: null,
      responseKind: 'not_configured',
      rawPayload: null,
      responsePreview: null,
      requestBody: null,
      requestMode: 'not_configured',
      dateRange: null,
      attempts: [],
      message: 'Summary Page probe is not configured. Add TRIPLE_WHALE_SHOP_DOMAIN/TIMEZONE/CURRENCY or TRIPLE_WHALE_SUMMARY_BODY_JSON before attempting a live Summary Page request.',
    };
  }

  const attempts: TripleWhaleSummaryProbeAttempt[] = [];
  let lastConfigured = configuredBodies[0];
  let lastAttempt: TripleWhaleSummaryProbeAttempt | null = null;
  let lastRawPayload: Record<string, unknown> | null = null;

  try {
    for (const configured of configuredBodies) {
      lastConfigured = configured;
      const result = await postSummaryProbeAttempt(apiKey, configured);
      lastAttempt = result.attempt;
      lastRawPayload = result.rawPayload;
      attempts.push(result.attempt);

      if (result.attempt.ok) {
        return {
          attempted: true,
          ok: true,
          httpStatus: result.attempt.httpStatus,
          contentType: result.attempt.contentType,
          responseKind: result.attempt.responseKind,
          rawPayload: result.rawPayload,
          responsePreview: result.attempt.responsePreview,
          requestBody: configured.body,
          requestMode: configured.mode,
          dateRange: configured.dateRange,
          attempts,
          message: `Triple Whale Summary Page probe returned successfully using ${configured.mode}. Mapper will normalize known fields conservatively and preserve raw payload for review.`,
        };
      }
    }

    return {
      attempted: true,
      ok: false,
      httpStatus: lastAttempt?.httpStatus ?? null,
      contentType: lastAttempt?.contentType ?? null,
      responseKind: lastAttempt?.responseKind ?? 'empty',
      rawPayload: lastRawPayload,
      responsePreview: lastAttempt?.responsePreview ?? null,
      requestBody: lastConfigured.body,
      requestMode: lastConfigured.mode,
      dateRange: lastConfigured.dateRange,
      attempts,
      message: `Triple Whale Summary Page probe tried ${attempts.length} request variant(s), but all returned an error. Review attempts[] to identify the accepted period format.`,
    };
  } catch (error: any) {
    return {
      attempted: true,
      ok: false,
      httpStatus: null,
      contentType: null,
      responseKind: 'text',
      rawPayload: {
        error: 'network_or_fetch_error',
        message: error?.message || 'Triple Whale Summary fetch failed before receiving a response.',
        endpoint: buildUrl(env.TRIPLE_WHALE_SUMMARY_PATH),
      },
      responsePreview: error?.message || 'Triple Whale Summary fetch failed before receiving a response.',
      requestBody: lastConfigured?.body ?? null,
      requestMode: lastConfigured?.mode ?? 'not_configured',
      dateRange: lastConfigured?.dateRange ?? null,
      attempts,
      message: error?.message || 'Triple Whale Summary fetch failed before receiving a response.',
    };
  }
}


async function postAttributionProbeAttempt(apiKey: string, configured: ConfiguredAttributionBody): Promise<{
  attempt: TripleWhaleAttributionProbeAttempt;
  rawPayload: Record<string, unknown> | null;
}> {
  const url = buildUrl(env.TRIPLE_WHALE_ATTRIBUTION_PATH);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': 'LIFE.SAVER-v0.5.2-dev',
    },
    body: JSON.stringify(configured.body),
  });

  const parsed = await readBoundedResponse(response);
  const attempt: TripleWhaleAttributionProbeAttempt = {
    mode: configured.mode,
    ok: response.ok,
    httpStatus: response.status,
    contentType: parsed.contentType,
    responseKind: parsed.responseKind,
    message: response.ok
      ? `Triple Whale Pixel/Attribution probe returned successfully using ${configured.mode}.`
      : `Triple Whale Pixel/Attribution probe returned ${response.status} using ${configured.mode}.`,
    requestBody: configured.body,
    responsePreview: parsed.preview,
  };

  return { attempt, rawPayload: parsed.jsonPayload };
}

export async function fetchTripleWhaleAttributionProbe(apiKey: string): Promise<TripleWhaleAttributionProbeResult> {
  let configuredBodies: ConfiguredAttributionBody[];
  try {
    configuredBodies = buildConfiguredAttributionBodies();
  } catch (error: any) {
    return {
      attempted: false,
      ok: false,
      httpStatus: null,
      contentType: null,
      responseKind: 'not_configured',
      rawPayload: null,
      responsePreview: null,
      requestBody: null,
      requestMode: 'not_configured',
      dateRange: null,
      attempts: [],
      message: error?.message || 'Triple Whale Pixel/Attribution request body configuration is invalid.',
    };
  }

  if (!configuredBodies.length) {
    return {
      attempted: false,
      ok: false,
      httpStatus: null,
      contentType: null,
      responseKind: 'not_configured',
      rawPayload: null,
      responsePreview: null,
      requestBody: null,
      requestMode: 'not_configured',
      dateRange: null,
      attempts: [],
      message: 'Triple Whale Pixel/Attribution probe is not configured. Add TRIPLE_WHALE_SHOP_DOMAIN or TRIPLE_WHALE_ATTRIBUTION_BODY_JSON before attempting a live attribution request.',
    };
  }

  const attempts: TripleWhaleAttributionProbeAttempt[] = [];
  let lastConfigured = configuredBodies[0];
  let lastAttempt: TripleWhaleAttributionProbeAttempt | null = null;
  let lastRawPayload: Record<string, unknown> | null = null;

  try {
    for (const configured of configuredBodies) {
      lastConfigured = configured;
      const result = await postAttributionProbeAttempt(apiKey, configured);
      lastAttempt = result.attempt;
      lastRawPayload = result.rawPayload;
      attempts.push(result.attempt);

      if (result.attempt.ok) {
        return {
          attempted: true,
          ok: true,
          httpStatus: result.attempt.httpStatus,
          contentType: result.attempt.contentType,
          responseKind: result.attempt.responseKind,
          rawPayload: result.rawPayload,
          responsePreview: result.attempt.responsePreview,
          requestBody: configured.body,
          requestMode: configured.mode,
          dateRange: configured.dateRange,
          attempts,
          message: `Triple Whale Pixel/Attribution probe returned successfully using ${configured.mode}. Store only redacted previews in the browser; treat customer journey data as sensitive developer data.`,
        };
      }
    }

    return {
      attempted: true,
      ok: false,
      httpStatus: lastAttempt?.httpStatus ?? null,
      contentType: lastAttempt?.contentType ?? null,
      responseKind: lastAttempt?.responseKind ?? 'empty',
      rawPayload: lastRawPayload,
      responsePreview: lastAttempt?.responsePreview ?? null,
      requestBody: lastConfigured.body,
      requestMode: lastConfigured.mode,
      dateRange: lastConfigured.dateRange,
      attempts,
      message: `Triple Whale Pixel/Attribution probe tried ${attempts.length} request variant(s), but all returned an error. Review attempts[] and the endpoint/scope/body configuration.`,
    };
  } catch (error: any) {
    return {
      attempted: true,
      ok: false,
      httpStatus: null,
      contentType: null,
      responseKind: 'text',
      rawPayload: {
        error: 'network_or_fetch_error',
        message: error?.message || 'Triple Whale Pixel/Attribution fetch failed before receiving a response.',
        endpoint: buildUrl(env.TRIPLE_WHALE_ATTRIBUTION_PATH),
      },
      responsePreview: error?.message || 'Triple Whale Pixel/Attribution fetch failed before receiving a response.',
      requestBody: lastConfigured?.body ?? null,
      requestMode: lastConfigured?.mode ?? 'not_configured',
      dateRange: lastConfigured?.dateRange ?? null,
      attempts,
      message: error?.message || 'Triple Whale Pixel/Attribution fetch failed before receiving a response.',
    };
  }
}

// Backward-compatible alias used by older service names.
export async function testTripleWhaleReadOnlyConnection(apiKey: string) {
  const result = await validateTripleWhaleApiKey(apiKey);
  return {
    liveVerificationEnabled: true,
    configuredUrl: true,
    httpStatus: result.httpStatus,
    ok: result.ok,
    contentType: result.contentType,
    responseKind: result.responseKind,
    responsePreview: result.responsePreview,
    message: result.message,
  };
}
