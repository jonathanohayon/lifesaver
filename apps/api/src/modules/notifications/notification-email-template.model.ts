import { z } from 'zod';
import type { NotificationEmailTemplateActionInput, NotificationEmailTemplateOutput } from './notification-email-template.types.js';

export const NOTIFICATION_EMAIL_TEMPLATE_PHASE = 'phase_10_3_email_notification_template' as const;
export const NOTIFICATION_EMAIL_TEMPLATE_VERSION = '0.7.0' as const;

const forbiddenFragments = [
  'access_token',
  'refresh_token',
  'authorization',
  'bearer ',
  'api_key',
  'claude_api_key',
  'triple_whale',
  'database_url',
  'password=',
  'password:',
  'client_secret',
  'worker_shared_secret',
  'app_encryption_key',
  'encrypted_',
  'raw_payload',
  'payload_json',
  'rollback_payload',
  'smtp_password',
  'slack_webhook',
];

const secretLikePattern = /(access[_ -]?token|refresh[_ -]?token|authorization|bearer\s+|api[_ -]?key|claude[_ -]?api[_ -]?key|triple[_ -]?whale|database[_ -]?url|password\s*[:=]|client[_ -]?secret|worker[_ -]?shared[_ -]?secret|app[_ -]?encryption[_ -]?key|encrypted[_ -]?|raw[_ -]?payload|payload[_ -]?json|rollback[_ -]?payload|smtp[_ -]?password|slack[_ -]?webhook)\s*[:=]?\s*[^\s<>,;)]*/gi;

export const notificationEmailTemplateInputSchema = z.object({
  actionId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(220),
  actionType: z.string().trim().min(1).max(80),
  riskLevel: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(1).max(700),
  reviewUrl: z.string().trim().min(1).max(600),
  createdAt: z.union([z.date(), z.string(), z.null()]).optional(),
  workspaceName: z.string().trim().max(120).nullable().optional(),
}).strict();

type ParsedNotificationEmailTemplateInput = z.infer<typeof notificationEmailTemplateInputSchema>;

function normalizeWhitespace(value: string, max: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

export function redactSensitiveText(value: string, max = 700): string {
  const normalized = normalizeWhitespace(value, max);
  return normalized.replace(secretLikePattern, '[redacted secret]');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeCreatedAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function validateReviewUrl(reviewUrl: string): string {
  const clean = reviewUrl.trim();
  const lower = clean.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:')) {
    throw new Error('Email notification reviewUrl must not use unsafe URL schemes.');
  }
  if (lower.includes('access_token') || lower.includes('refresh_token') || lower.includes('authorization=')) {
    throw new Error('Email notification reviewUrl must not contain token or authorization material.');
  }
  const mutationParams = ['approve','approved','reject','rejected','execute','executed','publish','send','run','rollback','delete','confirm','autoapprove','auto_approve','decision','status','action_status','mutation','method'];
  let parsed: URL;
  try {
    parsed = new URL(clean, 'https://lifesaveragent.com');
  } catch {
    throw new Error('Email notification reviewUrl must be relative or a valid HTTPS URL.');
  }
  for (const key of mutationParams) {
    if (parsed.searchParams.has(key)) {
      throw new Error('Email notification reviewUrl must open review only and must not include approval/execution parameters.');
    }
  }
  if (!parsed.pathname.toLowerCase().endsWith('/actions.html')) {
    throw new Error('Email notification reviewUrl must open the action review app screen.');
  }
  if (clean.startsWith('./') || clean.startsWith('/')) {
    return clean;
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Email notification reviewUrl must use HTTPS when absolute.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Email notification reviewUrl must not contain embedded credentials.');
  }
  return parsed.toString();
}

function riskBadgeColor(riskLevel: string): string {
  const risk = riskLevel.toLowerCase();
  if (risk === 'critical') return '#7f1d1d';
  if (risk === 'high') return '#92400e';
  if (risk === 'medium') return '#1d4ed8';
  return '#166534';
}

function buildHtml(input: {
  title: string;
  actionType: string;
  riskLevel: string;
  reason: string;
  reviewUrl: string;
  workspaceName: string | null;
  createdAt: string | null;
}): string {
  const riskColor = riskBadgeColor(input.riskLevel);
  const safeTitle = escapeHtml(input.title);
  const safeType = escapeHtml(input.actionType);
  const safeRisk = escapeHtml(input.riskLevel);
  const safeReason = escapeHtml(input.reason);
  const safeReviewUrl = escapeHtml(input.reviewUrl);
  const safeWorkspace = input.workspaceName ? escapeHtml(input.workspaceName) : 'LIFE.SAVER workspace';
  const safeCreated = input.createdAt ? escapeHtml(input.createdAt) : 'Not provided';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>LIFE.SAVER approval needed</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;color:#172033;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7fb;margin:0;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;color:#ffffff;padding:22px 26px;">
                <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;">LIFE.SAVER Approval Request</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;font-weight:700;">Action needs your review</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#334155;">Certainly, sir. LIFE.SAVER has prepared an action that requires manual approval before anything can happen.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:18px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:12px 14px;background:#f8fafc;color:#64748b;font-size:13px;width:34%;">Action title</td>
                    <td style="padding:12px 14px;color:#0f172a;font-size:14px;font-weight:700;">${safeTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f8fafc;color:#64748b;font-size:13px;">Action type</td>
                    <td style="padding:12px 14px;color:#0f172a;font-size:14px;">${safeType}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f8fafc;color:#64748b;font-size:13px;">Risk level</td>
                    <td style="padding:12px 14px;color:#0f172a;font-size:14px;"><span style="display:inline-block;background:${riskColor};color:#ffffff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;text-transform:uppercase;">${safeRisk}</span></td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f8fafc;color:#64748b;font-size:13px;">Reason</td>
                    <td style="padding:12px 14px;color:#0f172a;font-size:14px;line-height:1.5;">${safeReason}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f8fafc;color:#64748b;font-size:13px;">Workspace</td>
                    <td style="padding:12px 14px;color:#0f172a;font-size:14px;">${safeWorkspace}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f8fafc;color:#64748b;font-size:13px;">Created</td>
                    <td style="padding:12px 14px;color:#0f172a;font-size:14px;">${safeCreated}</td>
                  </tr>
                </table>
                <p style="margin:18px 0 24px;font-size:14px;line-height:1.55;color:#475569;">Review the action in LIFE.SAVER before approving, rejecting, or executing. This email does not contain tokens, raw payloads, or platform secrets.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:#2563eb;">
                      <a href="${safeReviewUrl}" style="display:inline-block;padding:13px 18px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;">Review action</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 26px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">
                This is a notification template preview for Phase 10.3. Email delivery is not enabled in this phase.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildApprovalNeededEmailTemplate(input: NotificationEmailTemplateActionInput): NotificationEmailTemplateOutput {
  const parsed: ParsedNotificationEmailTemplateInput = notificationEmailTemplateInputSchema.parse(input);
  const reviewUrl = validateReviewUrl(parsed.reviewUrl);
  const actionId = redactSensitiveText(parsed.actionId, 120);
  const title = redactSensitiveText(parsed.title, 180);
  const actionType = redactSensitiveText(parsed.actionType, 80);
  const riskLevel = redactSensitiveText(parsed.riskLevel, 40).toLowerCase();
  const reason = redactSensitiveText(parsed.reason, 520);
  const workspaceName = parsed.workspaceName ? redactSensitiveText(parsed.workspaceName, 120) : null;
  const createdAt = normalizeCreatedAt(parsed.createdAt);

  const subject = redactSensitiveText(`[LIFE.SAVER] Approval needed: ${title}`, 120);
  const preheader = redactSensitiveText(`${actionType} is waiting for review. Risk level: ${riskLevel}.`, 160);
  const textBody = [
    'LIFE.SAVER approval request',
    '',
    `Action title: ${title}`,
    `Action type: ${actionType}`,
    `Risk level: ${riskLevel}`,
    `Reason: ${reason}`,
    createdAt ? `Created: ${createdAt}` : 'Created: Not provided',
    '',
    `Review link: ${reviewUrl}`,
    '',
    'Safety note: This template does not include access tokens, refresh tokens, raw payload JSON, rollback payloads, or platform secrets. Email delivery is not enabled in Phase 10.3.',
  ].join('\n');

  const htmlBody = buildHtml({ title, actionType, riskLevel, reason, reviewUrl, workspaceName, createdAt });

  const output: NotificationEmailTemplateOutput = {
    version: NOTIFICATION_EMAIL_TEMPLATE_VERSION,
    phase: NOTIFICATION_EMAIL_TEMPLATE_PHASE,
    templateKey: 'approval_needed_email',
    subject,
    preheader,
    textBody,
    htmlBody,
    reviewUrl,
    action: {
      actionId,
      title,
      actionType,
      riskLevel,
      reason,
      createdAt,
      workspaceName,
    },
    safety: {
      templateOnly: true,
      sendsEmailInThisPhase: false,
      callsExternalEmailProvider: false,
      includesActionTitle: true,
      includesActionType: true,
      includesRiskLevel: true,
      includesReason: true,
      includesReviewLink: true,
      exposesTokensOrSecrets: false,
      exposesRawPayloadJson: false,
      includesAttachments: false,
      includesTrackingPixel: false,
    },
  };

  assertSafeEmailTemplate(output);
  return output;
}

export function assertSafeEmailTemplate(template: NotificationEmailTemplateOutput): void {
  const serialized = JSON.stringify(template).toLowerCase();
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) {
      throw new Error(`Email notification template contains forbidden fragment: ${fragment}`);
    }
  }
  const html = template.htmlBody.toLowerCase();
  const forbiddenHtml = ['<script', '<iframe', '<form', '<input', 'javascript:', 'data:', 'file:'];
  for (const fragment of forbiddenHtml) {
    if (html.includes(fragment)) {
      throw new Error(`Email notification template contains unsafe HTML fragment: ${fragment}`);
    }
  }
  if (!template.safety.templateOnly || template.safety.sendsEmailInThisPhase || template.safety.callsExternalEmailProvider) {
    throw new Error('Phase 10.3 email notification template must remain template-only and must not send email.');
  }
  if (!template.safety.includesActionTitle || !template.safety.includesActionType || !template.safety.includesRiskLevel || !template.safety.includesReason || !template.safety.includesReviewLink) {
    throw new Error('Email notification template is missing required approval fields.');
  }
}
