export interface AdminOverviewResponse {
  app: {
    name: string;
    version: string;
    mode: string;
    environment: string;
  };
  architecture: {
    currentStage: string;
    v1Scope: string;
    futureSaasDirection: string;
    dataOwnershipRule: string;
  };
  workspaceModel: {
    currentV1: string;
    futureSaas: string;
    isolationRule: string;
  };
  emergencySafeMode: {
    active: boolean;
    reason: string | null;
    adminWarningVisible: boolean;
    executionBlocked: boolean;
    autoApprovalAllowed: false;
    executorExecutionAllowed: false;
    envKey: 'EMERGENCY_SAFE_MODE';
    warning: string;
  };
  databaseSummary: {
    connected: boolean;
    seeded: boolean;
    counts: {
      users: number;
      workspaces: number;
      workspaceMembers: number;
      connectedAccounts: number;
      metricsSnapshots: number;
      chatMessages: number;
      briefs: number;
      drafts: number;
      usageLogs: number;
      systemEvents: number;
    } | null;
    defaultWorkspace: {
      id: string;
      name: string;
      slug: string | null;
      status: string;
      planKey: string;
      ownerEmail: string | null;
      createdAt: string;
    } | null;
    latestEvents: Array<{
      eventType: string;
      severity: string;
      message: string;
      createdAt: string;
    }>;
    connectionSummaries: Array<{
      workspaceId: string;
      workspaceName: string;
      ownerEmail: string | null;
      provider: string;
      status: string;
      keyHint: string | null;
      lastConnectedAt: string | null;
      updatedAt: string | null;
      ownership: 'customer_workspace_owned';
      rawKeyVisibleToAdmin: false;
    }>;
    latestMetricsSnapshot: {
      id: string;
      provider: string;
      dateRange: string;
      source: string;
      revenue: number | null;
      orders: number | null;
      roas: number | null;
      adSpend: number | null;
      createdAt: string;
      sourceNote: string | null;
      sourceStatus: string | null;
      productionReady: boolean;
    } | null;
  };
  adminPanels: Array<{
    key: string;
    name: string;
    purpose: string;
    status: 'planned' | 'mock' | 'ready';
  }>;
  apiEndpoints: Array<{
    method: string;
    path: string;
    purpose: string;
    status: 'mock' | 'ready' | 'planned';
  }>;
  safetyRules: string[];
  nextMilestones: string[];
}
