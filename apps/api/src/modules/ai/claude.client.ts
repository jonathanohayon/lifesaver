import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import type { ClaudeToolDefinition } from './ai-tool-runner.js';

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input?: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | Record<string, unknown>;

export type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
};

export type ClaudeToolUse = {
  id: string;
  name: string;
  input: unknown;
};

export type ClaudeChatResult = {
  reply: string;
  model: string;
  stopReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  requestId?: string | null;
  contentBlocks?: ClaudeContentBlock[];
  toolUses?: ClaudeToolUse[];
};

export type ClaudeApiKeySource = 'CLAUDE_API_KEY' | 'ANTHROPIC_API_KEY';

export type ClaudeApiKeyCandidate = {
  source: ClaudeApiKeySource;
  value: string;
  rawPresent: boolean;
  neededNormalization: boolean;
};

export function normalizeClaudeApiKey(value?: string | null): string {
  let normalized = String(value || '').trim();

  const assignment = normalized.match(/^(?:CLAUDE_API_KEY|ANTHROPIC_API_KEY)\s*=\s*(.+)$/i);
  if (assignment) normalized = assignment[1].trim();

  normalized = normalized.replace(/^Bearer\s+/i, '').trim();
  normalized = normalized.replace(/^['"]|['"]$/g, '').trim();

  // Render and copy/paste can accidentally preserve hidden line breaks or spaces.
  // Anthropic keys contain no whitespace, so removing whitespace is safe for the key only.
  normalized = normalized.replace(/\s+/g, '');

  return normalized;
}

function buildClaudeKeyCandidate(source: ClaudeApiKeySource, rawValue?: string | null): ClaudeApiKeyCandidate | null {
  const raw = String(rawValue || '');
  const value = normalizeClaudeApiKey(raw);
  if (!value || value.length <= 10) return null;
  return {
    source,
    value,
    rawPresent: raw.length > 0,
    neededNormalization: raw !== value,
  };
}

export function getClaudeApiKeyCandidates(): ClaudeApiKeyCandidate[] {
  const candidates = [
    buildClaudeKeyCandidate('CLAUDE_API_KEY', env.CLAUDE_API_KEY),
    buildClaudeKeyCandidate('ANTHROPIC_API_KEY', env.ANTHROPIC_API_KEY),
  ].filter(Boolean) as ClaudeApiKeyCandidate[];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.value)) return false;
    seen.add(candidate.value);
    return true;
  });
}

export function getClaudeRuntimeStatus() {
  const candidates = getClaudeApiKeyCandidates();
  const rawClaude = String(env.CLAUDE_API_KEY || '');
  const rawAnthropic = String(env.ANTHROPIC_API_KEY || '');

  return {
    version: '0.8.5',
    healthMode: 'v2-functional-0-8-5-claude-backend-compatibility',
    configured: candidates.length > 0,
    candidateSources: candidates.map((candidate) => candidate.source),
    selectedSource: candidates[0]?.source || null,
    model: env.CLAUDE_MODEL,
    apiBaseUrl: env.CLAUDE_API_BASE_URL,
    apiVersion: env.CLAUDE_API_VERSION,
    maxTokens: env.CLAUDE_MAX_TOKENS,
    temperature: env.CLAUDE_TEMPERATURE,
    safety: {
      serverSideOnly: true,
      keyExposed: false,
      externalWrites: false,
      actionExecution: false,
    },
    envChecks: {
      claudeApiKeyPresent: Boolean(rawClaude.trim()),
      anthropicApiKeyPresent: Boolean(rawAnthropic.trim()),
      claudeApiKeyNeededNormalization: Boolean(rawClaude && normalizeClaudeApiKey(rawClaude) !== rawClaude),
      anthropicApiKeyNeededNormalization: Boolean(rawAnthropic && normalizeClaudeApiKey(rawAnthropic) !== rawAnthropic),
      supportsAnthropicApiKeyFallback: true,
      retriesAlternateKeyOnInvalidKey: true,
    },
  };
}

function extractTextFromClaudeResponse(payload: any): string {
  const blocks = Array.isArray(payload?.content) ? payload.content : [];
  const text = blocks
    .filter((block: any) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block: any) => block.text)
    .join('\n')
    .trim();
  return text;
}

function extractToolUses(payload: any): ClaudeToolUse[] {
  const blocks = Array.isArray(payload?.content) ? payload.content : [];
  return blocks
    .filter((block: any) => block && block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string')
    .map((block: any) => ({ id: String(block.id), name: String(block.name), input: block.input || {} }));
}

export function isClaudeConfigured(): boolean {
  return getClaudeApiKeyCandidates().length > 0;
}

export async function createClaudeMessage(params: {
  system: string;
  messages: ClaudeMessage[];
  tools?: ClaudeToolDefinition[];
}): Promise<ClaudeChatResult> {
  if (!isClaudeConfigured()) {
    throw new AppError(503, 'CLAUDE_NOT_CONFIGURED', 'Claude API key is not configured yet. Add CLAUDE_API_KEY or ANTHROPIC_API_KEY to enable live Claude chat.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const body: Record<string, unknown> = {
      model: env.CLAUDE_MODEL,
      max_tokens: env.CLAUDE_MAX_TOKENS,
      temperature: env.CLAUDE_TEMPERATURE,
      system: params.system,
      messages: params.messages,
    };

    if (params.tools && params.tools.length) {
      body.tools = params.tools;
    }

    const candidates = getClaudeApiKeyCandidates();
    let lastAuthError: AppError | null = null;

    for (const candidate of candidates) {
      const response = await fetch(`${env.CLAUDE_API_BASE_URL.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': candidate.value,
          'anthropic-version': env.CLAUDE_API_VERSION,
        },
        body: JSON.stringify(body),
      });

      const requestId = response.headers.get('request-id');
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `Claude request failed with HTTP ${response.status}.`;
        const appError = new AppError(response.status, 'CLAUDE_API_ERROR', message);
        if (response.status === 401 && candidates.length > 1) {
          lastAuthError = appError;
          continue;
        }
        throw appError;
      }

      const reply = extractTextFromClaudeResponse(payload);
      const contentBlocks = Array.isArray(payload?.content) ? payload.content : [];
      const toolUses = extractToolUses(payload);

      if (!reply && !toolUses.length) {
        throw new AppError(502, 'CLAUDE_EMPTY_RESPONSE', 'Claude returned no text or tool response.');
      }

      return {
        reply,
        model: String(payload?.model || env.CLAUDE_MODEL),
        stopReason: payload?.stop_reason ? String(payload.stop_reason) : undefined,
        usage: {
          inputTokens: Number(payload?.usage?.input_tokens || 0),
          outputTokens: Number(payload?.usage?.output_tokens || 0),
        },
        requestId,
        contentBlocks,
        toolUses,
      };
    }

    throw lastAuthError || new AppError(503, 'CLAUDE_NOT_CONFIGURED', 'Claude API key is not configured yet. Add CLAUDE_API_KEY or ANTHROPIC_API_KEY to enable live Claude chat.');
  } finally {
    clearTimeout(timeout);
  }
}
