import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { getLatestMetrics, getMockMetrics } from '../metrics/metrics.service.js';
import type { NormalizedMetrics } from '../metrics/metrics.types.js';
import { buildBusinessMetricsContext, describeSafeToolInventory } from '../ai/ai-tools.js';
import { buildLifesaverSystemPrompt } from '../ai/lifesaver-persona.js';
import { insertDraft, recordDraftEvent } from '../drafts/drafts.repository.js';
import {
  createClaudeMessage,
  isClaudeConfigured,
  type ClaudeMessage,
  type ClaudeToolUse,
  type ClaudeContentBlock,
} from '../ai/claude.client.js';
import { executeLifesaverClaudeTool, lifesaverClaudeTools, type ExecutedToolResult } from '../ai/ai-tool-runner.js';
import type { ChatHistoryMessage, ChatReply } from './chat.types.js';
import {
  countClaudeChatCallsToday,
  getDefaultWorkspaceContext,
  insertChatMessage,
  insertSystemEvent,
  insertUsageLog,
} from './chat.repository.js';

function money(value: unknown): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function roas(value: unknown): string {
  return `${Number(value || 0).toFixed(2)}x`;
}

function isCoreLive(metrics: NormalizedMetrics): boolean {
  return Boolean(metrics.coreMetricsProductionReady || metrics.productionReady || String(metrics.sourceStatus || '').includes('core_metrics_ready'));
}

function fallbackReply(message: string, metrics: NormalizedMetrics, reason: string): string {
  const q = message.toLowerCase();
  const live = isCoreLive(metrics);
  const draftIntent = detectDraftIntent(message);

  if (draftIntent === 'support_reply') {
    return `Certainly, sir. Here is a safe support reply draft for review only:

Hi there,

Thank you for reaching out. I understand the concern, and I appreciate you giving us the opportunity to look into it properly.

I am going to review the details carefully and make sure the next step is handled clearly and fairly. We will follow up with the best available resolution as soon as possible.

Best,
Customer Support

[Draft only — no message was sent. Safe fallback reason: ${reason}]`;
  }

  if (draftIntent === 'content') {
    const context = live
      ? `Current verified context: ${money(metrics.revenue)} revenue, ${metrics.orders} orders, ${money(metrics.adSpend)} paid-media spend, and ${roas(metrics.roas)} blended ROAS.`
      : 'Current verified metrics are not production-ready yet, so this draft avoids claiming specific live figures.';
    return `Certainly, sir. Here is a safe content draft for founder approval only:

Hook: The numbers are only useful when they tell you what to do next.

Body: ${context} The calm move is to review revenue, orders, AOV, paid-media spend, and ROAS together before making the next decision. LIFE.SAVER is designed to turn scattered ecommerce signals into clear founder judgement.

CTA: Review the dashboard before your next move.

[Draft only — no post was published, scheduled, or sent. Safe fallback reason: ${reason}]`;
  }

  if (live) {
    return `Certainly, sir. Verified Triple Whale core metrics show ${money(metrics.revenue)} revenue, ${metrics.orders} orders, ${money(metrics.adSpend)} paid-media spend, and ${roas(metrics.roas)} blended ROAS. I am responding in safe fallback mode because ${reason}.`;
  }

  return `At your service, sir. LIFE.SAVER is running in safe advisory mode, but live Claude is not active because ${reason}. I will not invent business numbers or take external action.`;
}

function sanitizeHistory(history: ChatHistoryMessage[]): ClaudeMessage[] {
  const trimmed = history.slice(-env.MAX_CHAT_HISTORY_MESSAGES);
  return trimmed
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
}

function detectDraftIntent(message: string): 'content' | 'support_reply' | null {
  const q = message.toLowerCase();
  if (/support|reply|customer|ticket|refund|complain|complaint/.test(q) && /draft|write|create|prepare|reply/.test(q)) return 'support_reply';
  if (/draft|caption|post|script|reel|tiktok|instagram|youtube|content|email idea|copy/.test(q)) return 'content';
  return null;
}

async function maybeStoreChatDraft(params: {
  workspaceId?: string;
  userId: string | null;
  userPrompt: string;
  assistantReply: string;
  mode: string;
  model?: string;
}): Promise<{ id: string; draftType: string; status: string } | null> {
  if (!params.workspaceId) return null;
  const draftType = detectDraftIntent(params.userPrompt);
  if (!draftType) return null;

  const row = await insertDraft({
    workspaceId: params.workspaceId,
    userId: params.userId,
    draftType,
    prompt: params.userPrompt,
    content: params.assistantReply,
    metadata: {
      source: 'chat_auto_saved_draft',
      mode: params.mode,
      model: params.model || null,
      version: '0.6.0',
      safety: draftType === 'support_reply' ? 'draft_only_no_sending' : 'draft_only_no_posting',
    },
  });

  await recordDraftEvent({
    workspaceId: params.workspaceId,
    eventType: draftType === 'support_reply' ? 'chat_support_reply_draft_saved' : 'chat_content_draft_saved',
    message: 'A chat response was saved as a draft for founder approval only. No external action was taken.',
    metadata: { draftId: row.id, draftType, mode: params.mode, version: '0.6.0' },
  });

  return { id: row.id, draftType, status: String(row.status) };
}

function toolResultBlock(toolUse: ClaudeToolUse, result: ExecutedToolResult): ClaudeContentBlock {
  return {
    type: 'tool_result',
    tool_use_id: toolUse.id,
    content: JSON.stringify({
      ok: result.ok,
      externalAction: false,
      toolName: result.toolName,
      result: result.result,
      draftSaved: result.draftSaved || null,
      safety: 'LIFE.SAVER v1 tools are read/internal-draft only. No external platform was modified.',
    }),
    is_error: !result.ok,
  };
}

async function logToolExecution(params: {
  workspaceId: string;
  userId: string | null;
  result: ExecutedToolResult;
}): Promise<void> {
  await insertUsageLog({
    workspaceId: params.workspaceId,
    userId: params.userId,
    eventType: 'claude_safe_tool_executed',
    provider: 'anthropic',
    model: env.CLAUDE_MODEL,
    metadata: {
      toolName: params.result.toolName,
      ok: params.result.ok,
      externalAction: false,
      draftSaved: params.result.draftSaved || null,
      version: '0.6.0',
    },
  });
}

async function runClaudeWithSafeTools(params: {
  workspaceId: string;
  userId: string | null;
  system: string;
  messages: ClaudeMessage[];
  metrics: NormalizedMetrics;
  userPrompt: string;
}): Promise<{
  reply: string;
  model: string;
  stopReason?: string;
  requestId?: string | null;
  usage: { inputTokens: number; outputTokens: number };
  toolResults: ExecutedToolResult[];
}> {
  let messages = [...params.messages];
  const toolResults: ExecutedToolResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastModel = env.CLAUDE_MODEL;
  let lastStopReason: string | undefined;
  let lastRequestId: string | null | undefined;
  let lastReply = '';

  for (let round = 0; round <= env.CLAUDE_TOOL_MAX_CALLS; round += 1) {
    const response = await createClaudeMessage({ system: params.system, messages, tools: lifesaverClaudeTools });
    lastModel = response.model;
    lastStopReason = response.stopReason;
    lastRequestId = response.requestId;
    totalInputTokens += response.usage?.inputTokens || 0;
    totalOutputTokens += response.usage?.outputTokens || 0;
    lastReply = response.reply || lastReply;

    const toolUses = response.toolUses || [];
    if (!toolUses.length) {
      return {
        reply: response.reply || lastReply || 'Certainly, sir. I have completed the safe advisory check.',
        model: lastModel,
        stopReason: lastStopReason,
        requestId: lastRequestId,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        toolResults,
      };
    }

    const assistantBlocks = response.contentBlocks && response.contentBlocks.length ? response.contentBlocks : [{ type: 'text', text: response.reply }];
    const toolResultBlocks: ClaudeContentBlock[] = [];

    for (const toolUse of toolUses) {
      if (toolResults.length >= env.CLAUDE_TOOL_MAX_CALLS) {
        const limitResult: ExecutedToolResult = {
          ok: false,
          toolName: toolUse.name,
          externalAction: false,
          result: { error: `Tool call limit of ${env.CLAUDE_TOOL_MAX_CALLS} reached. No additional tool was executed.` },
          draftSaved: null,
        };
        toolResultBlocks.push(toolResultBlock(toolUse, limitResult));
        toolResults.push(limitResult);
        continue;
      }

      let result: ExecutedToolResult;
      try {
        result = await executeLifesaverClaudeTool({
          workspaceId: params.workspaceId,
          userId: params.userId,
          toolName: toolUse.name,
          input: toolUse.input,
          metrics: params.metrics,
          userPrompt: params.userPrompt,
        });
      } catch (error) {
        result = {
          ok: false,
          toolName: toolUse.name,
          externalAction: false,
          result: { error: error instanceof Error ? error.message : 'Tool execution failed safely.' },
          draftSaved: null,
        };
      }

      await logToolExecution({ workspaceId: params.workspaceId, userId: params.userId, result });
      toolResults.push(result);
      toolResultBlocks.push(toolResultBlock(toolUse, result));
    }

    messages = [
      ...messages,
      { role: 'assistant', content: assistantBlocks },
      { role: 'user', content: toolResultBlocks },
    ];
  }

  return {
    reply: lastReply || 'Certainly, sir. I completed the safe tool check, though I would recommend reviewing the draft panel and metrics panel for the stored results.',
    model: lastModel,
    stopReason: lastStopReason,
    requestId: lastRequestId,
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    toolResults,
  };
}

export async function getLifesaverChatReply(params: {
  message: string;
  history: ChatHistoryMessage[];
  workspaceId?: string;
  userId?: string;
}): Promise<ChatReply> {
  const defaultContext = params.workspaceId ? null : await getDefaultWorkspaceContext();
  const workspaceId = params.workspaceId || defaultContext?.workspaceId;
  const userId = params.userId || defaultContext?.userId || null;
  const metrics = workspaceId ? await getLatestMetrics(workspaceId) : getMockMetrics();

  if (workspaceId) {
    await insertChatMessage({
      workspaceId,
      userId,
      role: 'user',
      message: params.message,
      metadata: { source: 'frontend_chat', version: '0.6.0' },
    });
  }

  if (!isClaudeConfigured()) {
    const reply = fallbackReply(params.message, metrics, 'CLAUDE_API_KEY is not configured yet');
    let draftSaved = null;
    if (workspaceId) {
      await insertChatMessage({ workspaceId, userId, role: 'assistant', message: reply, metadata: { mode: 'safe_fallback', reason: 'claude_not_configured', version: '0.6.0' } });
      draftSaved = await maybeStoreChatDraft({ workspaceId, userId, userPrompt: params.message, assistantReply: reply, mode: 'safe_fallback' });
    }
    return {
      reply,
      mode: 'safe_fallback',
      metricsSource: metrics.sourceStatus || metrics.source,
      metricsProductionReady: Boolean(metrics.productionReady),
      draftSaved,
      availableTools: describeSafeToolInventory(),
      toolMode: 'safe_tools_unavailable',
      safety: { v1Mode: 'read_advise_draft_only', externalActionsEnabled: false },
    };
  }

  if (!workspaceId) {
    throw new AppError(503, 'WORKSPACE_NOT_AVAILABLE', 'No workspace is available for Claude chat context. Run database seed first.');
  }

  const callsToday = await countClaudeChatCallsToday(workspaceId);
  if (callsToday >= env.CLAUDE_DAILY_CHAT_LIMIT) {
    const reply = fallbackReply(params.message, metrics, `the daily Claude chat limit of ${env.CLAUDE_DAILY_CHAT_LIMIT} calls has been reached`);
    await insertUsageLog({
      workspaceId,
      userId,
      eventType: 'claude_chat_blocked_daily_limit',
      provider: 'anthropic',
      model: env.CLAUDE_MODEL,
      metadata: { limit: env.CLAUDE_DAILY_CHAT_LIMIT, callsToday, version: '0.6.0' },
    });
    return { reply, mode: 'safe_fallback', model: env.CLAUDE_MODEL, metricsSource: metrics.sourceStatus || metrics.source, metricsProductionReady: Boolean(metrics.productionReady), toolMode: 'safe_tools_unavailable', safety: { v1Mode: 'read_advise_draft_only', externalActionsEnabled: false } };
  }

  const metricsContext = buildBusinessMetricsContext(metrics);
  const system = buildLifesaverSystemPrompt(`${metricsContext}\n\nSAFE SERVER-SIDE TOOL INVENTORY:\n${JSON.stringify(describeSafeToolInventory(), null, 2)}`);
  const messages: ClaudeMessage[] = [
    ...sanitizeHistory(params.history),
    { role: 'user', content: params.message.slice(0, 4000) },
  ];

  try {
    const claude = await runClaudeWithSafeTools({
      workspaceId,
      userId,
      system,
      messages,
      metrics,
      userPrompt: params.message,
    });

    const draftFromTool = claude.toolResults.find((result) => result.draftSaved)?.draftSaved || null;

    await insertChatMessage({
      workspaceId,
      userId,
      role: 'assistant',
      message: claude.reply,
      metadata: {
        mode: 'claude_live',
        provider: 'anthropic',
        model: claude.model,
        stopReason: claude.stopReason || null,
        requestId: claude.requestId || null,
        metricsSnapshotId: metrics.snapshotId || null,
        toolCalls: claude.toolResults.map((result) => ({ name: result.toolName, ok: result.ok, externalAction: false, draftSaved: result.draftSaved || null })),
        version: '0.6.0',
      },
    });

    await insertUsageLog({
      workspaceId,
      userId,
      eventType: 'claude_chat_completed',
      provider: 'anthropic',
      model: claude.model,
      tokensIn: claude.usage.inputTokens || 0,
      tokensOut: claude.usage.outputTokens || 0,
      metadata: { requestId: claude.requestId || null, stopReason: claude.stopReason || null, toolCallCount: claude.toolResults.length, version: '0.6.0' },
    });

    const draftSaved = draftFromTool || await maybeStoreChatDraft({ workspaceId, userId, userPrompt: params.message, assistantReply: claude.reply, mode: 'claude_live', model: claude.model });

    return {
      reply: claude.reply,
      mode: 'claude_live',
      model: claude.model,
      metricsSource: metrics.sourceStatus || metrics.source,
      metricsProductionReady: Boolean(metrics.productionReady),
      usage: claude.usage,
      draftSaved,
      toolCalls: claude.toolResults.map((result) => ({ name: result.toolName, ok: result.ok, externalAction: false, draftSaved: result.draftSaved || null })),
      toolMode: claude.toolResults.length ? 'safe_tools_executed' : 'none',
      availableTools: describeSafeToolInventory(),
      safety: { v1Mode: 'read_advise_draft_only', externalActionsEnabled: false },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Claude request failed.';
    await insertSystemEvent({
      workspaceId,
      eventType: 'claude_chat_failed',
      severity: 'warning',
      message: 'Claude chat failed; LIFE.SAVER returned safe fallback reply.',
      metadata: { error: message, version: '0.6.0' },
    });

    const reply = fallbackReply(params.message, metrics, 'the Claude request failed temporarily');
    await insertChatMessage({ workspaceId, userId, role: 'assistant', message: reply, metadata: { mode: 'safe_fallback', reason: 'claude_error', error: message, version: '0.6.0' } });
    const draftSaved = await maybeStoreChatDraft({ workspaceId, userId, userPrompt: params.message, assistantReply: reply, mode: 'safe_fallback', model: env.CLAUDE_MODEL });

    return {
      reply,
      mode: 'safe_fallback',
      model: env.CLAUDE_MODEL,
      metricsSource: metrics.sourceStatus || metrics.source,
      metricsProductionReady: Boolean(metrics.productionReady),
      draftSaved,
      availableTools: describeSafeToolInventory(),
      toolMode: 'safe_tools_unavailable',
      safety: { v1Mode: 'read_advise_draft_only', externalActionsEnabled: false },
    };
  }
}
