import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getLatestMetrics } from '../metrics/metrics.service.js';
import { buildBusinessMetricsContext } from '../ai/ai-tools.js';
import { buildLifesaverSystemPrompt } from '../ai/lifesaver-persona.js';
import { createClaudeMessage, isClaudeConfigured } from '../ai/claude.client.js';
import { countDraftsToday, insertDraft, listDrafts, recordDraftEvent, updateDraftStatus } from './drafts.repository.js';
import type { DraftResponse, DraftRow } from './drafts.types.js';

const contentDraftSchema = z.object({
  prompt: z.string().min(3).max(4000),
  channel: z.string().max(80).optional().default('general'),
  tone: z.string().max(120).optional().default('calm, premium, founder-approved'),
});

const supportDraftSchema = z.object({
  ticket: z.string().min(3).max(5000),
  customerName: z.string().max(120).optional().default('Customer'),
  issueType: z.string().max(120).optional().default('general support'),
});

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required before storing drafts.');
  }
}

function toDraftResponse(row: DraftRow): DraftResponse {
  return {
    id: row.id,
    draftType: String(row.draft_type),
    prompt: row.prompt,
    content: row.content,
    status: String(row.status),
    metadata: row.metadata || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function safeLocalDraft(draftType: 'content' | 'support_reply', input: { prompt?: string; ticket?: string; channel?: string; customerName?: string; issueType?: string }): string {
  if (draftType === 'support_reply') {
    return `Hi ${input.customerName || 'there'},\n\nThank you for reaching out. I’m sorry to hear about the issue, and I appreciate you giving us the chance to look into it properly.\n\nI’ve reviewed your message and the best next step is for our team to check the order details carefully before giving you a final answer. We’ll make sure this is handled fairly and clearly.\n\nThank you for your patience.\n\nBest,\nCustomer Support\n\n[Draft only — review before sending]`;
  }

  return `Draft for ${input.channel || 'general'}:\n\nA calm, founder-approved content idea based on the request: “${(input.prompt || '').slice(0, 220)}”.\n\nHook: Here’s what most brands miss when they look at the numbers.\n\nBody: Revenue is only useful when it is understood beside orders, paid-media spend, AOV, and ROAS. The right move is not always to spend more — sometimes it is to protect margin, improve conversion, and let the data show where the pressure is building.\n\nCTA: Review your numbers before making the next move.\n\n[Draft only — no posting action was taken]`;
}

async function buildDraftWithClaude(params: {
  workspaceId: string;
  draftType: 'content' | 'support_reply';
  instruction: string;
}): Promise<{ content: string; mode: 'claude_live' | 'safe_fallback'; model?: string; usage?: { inputTokens?: number; outputTokens?: number } }> {
  const metrics = await getLatestMetrics(params.workspaceId);
  const metricsContext = buildBusinessMetricsContext(metrics);
  const baseSystem = buildLifesaverSystemPrompt(metricsContext);
  const system = `${baseSystem}\n\nDRAFT TOOL RULES:\n- Return a reusable draft only.\n- Do not claim it was posted, sent, scheduled, or approved.\n- Use the LIFE.SAVER calm British-butler standard without becoming theatrical.\n- If data is missing, say the draft is based on available context only.\n- Include a short review note when helpful.\n- Never include hidden API details, raw keys, or secrets.`;

  if (!isClaudeConfigured()) {
    const content = params.draftType === 'support_reply'
      ? safeLocalDraft('support_reply', { ticket: params.instruction })
      : safeLocalDraft('content', { prompt: params.instruction });
    return { content, mode: 'safe_fallback' };
  }

  const result = await createClaudeMessage({
    system,
    messages: [{ role: 'user', content: params.instruction }],
  });

  return { content: result.reply, mode: 'claude_live', model: result.model, usage: result.usage };
}

async function assertDraftLimit(workspaceId: string) {
  const count = await countDraftsToday(workspaceId);
  if (count >= env.DRAFT_DAILY_LIMIT) {
    throw new AppError(429, 'DRAFT_DAILY_LIMIT_REACHED', `Daily draft limit of ${env.DRAFT_DAILY_LIMIT} drafts has been reached.`);
  }
}

export async function createContentDraft(workspaceId: string, userId: string | null, input: unknown): Promise<{ draft: DraftResponse; mode: 'claude_live' | 'safe_fallback'; safety: Record<string, unknown> }> {
  assertDatabaseReady();
  await assertDraftLimit(workspaceId);
  const parsed = contentDraftSchema.parse(input);
  const instruction = `Draft ${parsed.channel} content for founder approval. Request: ${parsed.prompt}\nTone: ${parsed.tone}\nRemember: draft only, no posting.`;
  const generated = await buildDraftWithClaude({ workspaceId, draftType: 'content', instruction });
  const row = await insertDraft({
    workspaceId,
    userId,
    draftType: 'content',
    prompt: parsed.prompt,
    content: generated.content,
    metadata: { version: '0.6.0', mode: generated.mode, model: generated.model || null, channel: parsed.channel, tone: parsed.tone, usage: generated.usage || null, safety: 'draft_only_no_posting' },
  });
  await recordDraftEvent({ workspaceId, eventType: 'draft_content_created', message: 'A content draft was generated and stored for founder approval only.', metadata: { draftId: row.id, mode: generated.mode, version: '0.6.0' } });
  return { draft: toDraftResponse(row), mode: generated.mode, safety: { v1Mode: 'read_advise_draft_only', externalActionsEnabled: false, posted: false, sent: false } };
}

export async function createSupportReplyDraft(workspaceId: string, userId: string | null, input: unknown): Promise<{ draft: DraftResponse; mode: 'claude_live' | 'safe_fallback'; safety: Record<string, unknown> }> {
  assertDatabaseReady();
  await assertDraftLimit(workspaceId);
  const parsed = supportDraftSchema.parse(input);
  const instruction = `Draft a customer support reply for founder approval only.\nCustomer name: ${parsed.customerName}\nIssue type: ${parsed.issueType}\nTicket/message:\n${parsed.ticket}\nRemember: draft only, no sending.`;
  const generated = await buildDraftWithClaude({ workspaceId, draftType: 'support_reply', instruction });
  const row = await insertDraft({
    workspaceId,
    userId,
    draftType: 'support_reply',
    prompt: parsed.ticket,
    content: generated.content,
    metadata: { version: '0.6.0', mode: generated.mode, model: generated.model || null, customerName: parsed.customerName, issueType: parsed.issueType, usage: generated.usage || null, safety: 'draft_only_no_sending' },
  });
  await recordDraftEvent({ workspaceId, eventType: 'draft_support_reply_created', message: 'A support reply draft was generated and stored for founder approval only.', metadata: { draftId: row.id, mode: generated.mode, version: '0.6.0' } });
  return { draft: toDraftResponse(row), mode: generated.mode, safety: { v1Mode: 'read_advise_draft_only', externalActionsEnabled: false, posted: false, sent: false } };
}

export async function getDrafts(workspaceId: string): Promise<{ drafts: DraftResponse[]; safety: Record<string, unknown> }> {
  assertDatabaseReady();
  const rows = await listDrafts(workspaceId, 30);
  return { drafts: rows.map(toDraftResponse), safety: { draftsAreApprovalOnly: true, externalActionsEnabled: false } };
}

export async function setDraftStatus(workspaceId: string, draftId: string, status: 'draft' | 'approved' | 'rejected'): Promise<{ draft: DraftResponse; safety: Record<string, unknown> }> {
  assertDatabaseReady();
  const row = await updateDraftStatus({ workspaceId, draftId, status });
  if (!row) throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft was not found for this workspace.');
  await recordDraftEvent({
    workspaceId,
    eventType: status === 'approved' ? 'draft_internal_approval_recorded' : (status === 'rejected' ? 'draft_internal_rejection_recorded' : 'draft_status_reset_to_draft'),
    message: `Draft status updated to ${status}. This is an internal LIFE.SAVER status change only; no publish, send, refund, campaign edit, or external action was executed.`,
    metadata: {
      draftId,
      status,
      version: '0.6.0',
      v1ApprovalMeaning: 'internal_review_status_only',
      externalExecutionAttempted: false,
      posted: false,
      sent: false,
    },
  });
  return {
    draft: toDraftResponse(row),
    safety: {
      statusOnly: true,
      v1ApprovalMeaning: 'internal_review_status_only',
      externalActionsEnabled: false,
      externalExecutionAttempted: false,
      sent: false,
      posted: false,
      published: false,
    },
  };
}
