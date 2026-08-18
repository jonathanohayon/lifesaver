export type SupportSyncConnectorProvider = 'gmail' | 'helpdesk' | 'support_inbox' | 'zendesk' | 'gorgias' | 'help_scout';

export type SupportSyncConnectionState = 'connected' | 'disconnected' | 'not_configured';

export type SupportSyncTokenStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing' | 'unknown';

export type SupportSyncHealth = 'healthy' | 'warning' | 'error' | 'disconnected';

export type SupportSyncErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type SupportSyncErrorInput = {
  code?: string | null;
  message?: string | null;
  occurredAt?: string | null;
  retryable?: boolean | null;
  severity?: SupportSyncErrorSeverity | null;
};

export type SupportSyncStatusInput = {
  provider?: SupportSyncConnectorProvider | null;
  connected?: boolean | null;
  configured?: boolean | null;
  lastSyncAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastAttemptAt?: string | null;
  syncErrors?: SupportSyncErrorInput[] | null;
  tokenStatus?: SupportSyncTokenStatus | null;
  tokenExpiresAt?: string | null;
  tokenConnected?: boolean | null;
  readOnlyScopeGranted?: boolean | null;
};

export type SupportSyncSafeError = {
  code: string;
  message: string;
  occurredAt: string | null;
  retryable: boolean;
  severity: SupportSyncErrorSeverity;
  redacted: boolean;
};

export type SupportSyncStatusSnapshot = {
  provider: SupportSyncConnectorProvider;
  connectorLabel: string;
  connectionState: SupportSyncConnectionState;
  connectorConnected: boolean;
  configured: boolean;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
  syncErrorCount: number;
  recentSyncErrors: SupportSyncSafeError[];
  tokenStatus: SupportSyncTokenStatus;
  tokenExpiresAt: string | null;
  tokenValueReturned: false;
  rawTokenPayloadReturned: false;
  readOnlyScopeGranted: boolean;
  safeToImportReadOnly: boolean;
  syncHealth: SupportSyncHealth;
  uiBadges: string[];
  nextRecommendedAction: string;
};

export type SupportSyncStatusStatus = {
  phase: string;
  healthMode: string;
  deliverable: 'support_connector_status_ui';
  selectedConnector: 'gmail';
  connectorStatusUiAdded: boolean;
  showsConnectedDisconnected: boolean;
  showsLastSync: boolean;
  showsSyncErrors: boolean;
  showsTokenStatus: boolean;
  browserSafeOnly: boolean;
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  emailSendAdded: false;
  supportAutoReplyAdded: false;
  tokenValueReturned: false;
};

export type SupportSyncStatusPreview = {
  valid: true;
  snapshot: SupportSyncStatusSnapshot;
  safety: {
    browserSafeOnly: true;
    tokenValueReturned: false;
    rawTokenPayloadReturned: false;
    rawProviderPayloadReturned: false;
    gmailExternalApiCalled: false;
    emailSendAdded: false;
    supportAutoReplyAdded: false;
  };
};

export type SupportSyncStatusExample = {
  disconnected: SupportSyncStatusPreview;
  connectedHealthy: SupportSyncStatusPreview;
  connectedWithErrors: SupportSyncStatusPreview;
  expiredToken: SupportSyncStatusPreview;
};
