export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatRequestInput = {
  message: string;
  history: ChatHistoryMessage[];
};

export type ChatReply = {
  reply: string;
  mode: 'claude_live' | 'safe_fallback';
  model?: string;
  metricsSource?: string;
  metricsProductionReady?: boolean;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  toolCalls?: Array<{
    name: string;
    ok: boolean;
    externalAction: false;
    draftSaved?: { id: string; draftType: string; status: string } | null;
  }>;
  toolMode?: 'none' | 'safe_tools_executed' | 'safe_tools_unavailable';
  draftSaved?: {
    id: string;
    draftType: string;
    status: string;
  } | null;
  availableTools?: Array<{ name: string; purpose: string; externalAction: false; execution?: string }>;
  safety: {
    v1Mode: 'read_advise_draft_only';
    externalActionsEnabled: false;
  };
};
