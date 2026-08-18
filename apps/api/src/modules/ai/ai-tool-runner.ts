import { z } from 'zod';
import type { NormalizedMetrics } from '../metrics/metrics.types.js';
import { buildBusinessMetricsContext } from './ai-tools.js';
import { countDraftsToday, insertDraft, recordDraftEvent } from '../drafts/drafts.repository.js';
import { env } from '../../config/env.js';

export type ClaudeToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ExecutedToolResult = {
  ok: boolean;
  toolName: string;
  externalAction: false;
  result: Record<string, unknown>;
  draftSaved?: { id: string; draftType: string; status: string } | null;
};

export const lifesaverClaudeTools: ClaudeToolDefinition[] = [
  {
    name: 'get_business_metrics',
    description:
      'Read the latest already-normalized LIFE.SAVER business metrics for this workspace. This is read-only and returns verified Triple Whale core metrics, source status, channel spend, and confirmation flags.',
    input_schema: {
      type: 'object',
      properties: {
        includeChannelSpend: { type: 'boolean', description: 'Whether to include channel spend values.' },
        includeMappingFlags: { type: 'boolean', description: 'Whether to include source/production readiness flags.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'draft_content',
    description:
      'Save a content draft for founder review only. The draft is stored inside LIFE.SAVER and is not posted, scheduled, sent, or published. Use only when the founder asks for a draft/post/caption/script/ad copy/content idea.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The founder request or source brief that the draft responds to.' },
        content: { type: 'string', description: 'The complete reusable draft content to save for review.' },
        channel: { type: 'string', description: 'Optional intended channel such as Instagram, TikTok, email, ad copy, or general content.' },
      },
      required: ['prompt', 'content'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_support_reply',
    description:
      'Save a customer support reply draft for founder review only. The draft is stored inside LIFE.SAVER and is not emailed, messaged, sent, refunded, or applied to any order.',
    input_schema: {
      type: 'object',
      properties: {
        ticket: { type: 'string', description: 'The customer issue/ticket/request being answered.' },
        content: { type: 'string', description: 'The complete suggested support reply draft to save for review.' },
        customerName: { type: 'string', description: 'Optional customer name.' },
        issueType: { type: 'string', description: 'Optional issue category.' },
      },
      required: ['ticket', 'content'],
      additionalProperties: false,
    },
  },
];

const contentDraftToolSchema = z.object({
  prompt: z.string().min(1).max(4000),
  content: z.string().min(1).max(8000),
  channel: z.string().max(120).optional().default('chat_generated_content'),
});

const supportReplyToolSchema = z.object({
  ticket: z.string().min(1).max(5000),
  content: z.string().min(1).max(8000),
  customerName: z.string().max(120).optional().default('Customer'),
  issueType: z.string().max(120).optional().default('general support'),
});

function safeMetricsPayload(metrics: NormalizedMetrics, input: Record<string, unknown>): Record<string, unknown> {
  const includeChannelSpend = input.includeChannelSpend !== false;
  const includeMappingFlags = input.includeMappingFlags !== false;

  return {
    source: metrics.source,
    sourceStatus: metrics.sourceStatus,
    dateRange: metrics.dateRange,
    lastSyncedAt: metrics.lastSyncedAt,
    snapshotId: metrics.snapshotId || null,
    verifiedCoreMetrics: {
      revenue: metrics.revenue,
      orders: metrics.orders,
      aov: metrics.aov,
      paidMediaSpend: metrics.adSpend,
      blendedRoas: metrics.roas,
    },
    channelSpend: includeChannelSpend ? metrics.channelSpend || {} : 'omitted_by_tool_input',
    optionalMetrics: {
      conversionRate: metrics.conversionRateProductionReady ? metrics.conversionRate : 'not_confirmed',
      attributionRevenue: metrics.attributionProductionReady ? metrics.attribution : 'not_confirmed',
    },
    confirmationFlags: includeMappingFlags
      ? {
          productionReady: Boolean(metrics.productionReady),
          coreMetricsProductionReady: Boolean(metrics.coreMetricsProductionReady || metrics.productionReady),
          attributionProductionReady: Boolean(metrics.attributionProductionReady),
          conversionRateProductionReady: Boolean(metrics.conversionRateProductionReady),
        }
      : 'omitted_by_tool_input',
    notes: {
      sourceNote: metrics.sourceNote || null,
      sourceWarning: metrics.sourceWarning || null,
      attributionNote: metrics.attributionNote || 'Attribution revenue is not production-ready unless explicitly confirmed.',
      v1Safety: 'Read + advise + draft only. No external actions.',
    },
    readableContext: buildBusinessMetricsContext(metrics),
  };
}

async function assertDraftToolLimit(workspaceId: string): Promise<void> {
  const count = await countDraftsToday(workspaceId);
  if (count >= env.DRAFT_DAILY_LIMIT) {
    throw new Error(`Daily draft limit of ${env.DRAFT_DAILY_LIMIT} drafts has been reached.`);
  }
}

export async function executeLifesaverClaudeTool(params: {
  workspaceId: string;
  userId: string | null;
  toolName: string;
  input: unknown;
  metrics: NormalizedMetrics;
  userPrompt: string;
}): Promise<ExecutedToolResult> {
  const input = (params.input && typeof params.input === 'object' ? params.input : {}) as Record<string, unknown>;

  if (params.toolName === 'get_business_metrics') {
    return {
      ok: true,
      toolName: params.toolName,
      externalAction: false,
      result: safeMetricsPayload(params.metrics, input),
      draftSaved: null,
    };
  }

  if (params.toolName === 'draft_content') {
    await assertDraftToolLimit(params.workspaceId);
    const parsed = contentDraftToolSchema.parse(input);
    const row = await insertDraft({
      workspaceId: params.workspaceId,
      userId: params.userId,
      draftType: 'content',
      prompt: parsed.prompt || params.userPrompt,
      content: parsed.content,
      metadata: {
        source: 'claude_tool_call',
        toolName: params.toolName,
        channel: parsed.channel,
        version: '0.5.2',
        safety: 'draft_only_no_posting',
      },
    });
    await recordDraftEvent({
      workspaceId: params.workspaceId,
      eventType: 'claude_tool_content_draft_saved',
      message: 'Claude used draft_content to save a content draft for founder approval only. No external action was taken.',
      metadata: { draftId: row.id, toolName: params.toolName, version: '0.5.2' },
    });
    return {
      ok: true,
      toolName: params.toolName,
      externalAction: false,
      draftSaved: { id: row.id, draftType: String(row.draft_type), status: String(row.status) },
      result: {
        draftId: row.id,
        draftType: row.draft_type,
        status: row.status,
        message: 'Draft saved internally for founder approval only. It was not posted or sent.',
      },
    };
  }

  if (params.toolName === 'draft_support_reply') {
    await assertDraftToolLimit(params.workspaceId);
    const parsed = supportReplyToolSchema.parse(input);
    const row = await insertDraft({
      workspaceId: params.workspaceId,
      userId: params.userId,
      draftType: 'support_reply',
      prompt: parsed.ticket || params.userPrompt,
      content: parsed.content,
      metadata: {
        source: 'claude_tool_call',
        toolName: params.toolName,
        customerName: parsed.customerName,
        issueType: parsed.issueType,
        version: '0.5.2',
        safety: 'draft_only_no_sending',
      },
    });
    await recordDraftEvent({
      workspaceId: params.workspaceId,
      eventType: 'claude_tool_support_reply_draft_saved',
      message: 'Claude used draft_support_reply to save a support reply draft for founder approval only. No external action was taken.',
      metadata: { draftId: row.id, toolName: params.toolName, version: '0.5.2' },
    });
    return {
      ok: true,
      toolName: params.toolName,
      externalAction: false,
      draftSaved: { id: row.id, draftType: String(row.draft_type), status: String(row.status) },
      result: {
        draftId: row.id,
        draftType: row.draft_type,
        status: row.status,
        message: 'Support reply draft saved internally for founder approval only. It was not sent.',
      },
    };
  }

  return {
    ok: false,
    toolName: params.toolName,
    externalAction: false,
    result: {
      error: 'Unsupported tool. LIFE.SAVER v1 only allows get_business_metrics, draft_content, and draft_support_reply.',
      supportedTools: lifesaverClaudeTools.map((tool) => tool.name),
    },
    draftSaved: null,
  };
}
