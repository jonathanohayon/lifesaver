export type ActionStatus =
  | 'proposed'
  | 'approval_required'
  | 'auto_approved'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'queued'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'rollback_requested'
  | 'rolled_back';

export type ActionType =
  | 'content_publish'
  | 'support_reply_send'
  | 'ad_budget_adjust'
  | 'ad_pause'
  | 'research_task'
  | 'dev_task'
  | 'notification_send'
  | 'rollback_action';

export type ActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionPolicyDecision = 'not_evaluated' | 'ask' | 'auto_approve' | 'block';

export type ActionPolicyDecisionSnapshot = Record<string, unknown>;

export type ActionPolicyDecisionSnapshotSummary = {
  present: boolean;
  decision: string | null;
  reason: string | null;
  matched_policy_id: string | null;
  cap_status: string | null;
  evaluatedAt: string | null;
  recordedAt: string | null;
};

export type ActionEventType =
  | 'action_created'
  | 'policy_evaluated'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'queued'
  | 'execution_started'
  | 'execution_finished'
  | 'execution_failed'
  | 'rollback_requested'
  | 'rollback_started'
  | 'rollback_finished'
  | 'rollback_failed';

export type WorkspaceActionMembershipRow = {
  workspace_id: string;
  user_id: string;
  workspace_role: string;
  membership_status: string;
  user_platform_role: string;
};

export type WorkspaceActionSummaryRow = {
  id: string;
  workspace_id: string;
  created_by_user_id: string | null;
  action_type: ActionType;
  title: string;
  description: string | null;
  status: ActionStatus;
  risk_level: ActionRiskLevel;
  approval_required: boolean;
  policy_decision: ActionPolicyDecision;
  policy_decision_snapshot_json: ActionPolicyDecisionSnapshot;
  policy_evaluated_at: Date | null;
  idempotency_key: string | null;
  action_hash: string | null;
  created_at: Date;
  updated_at: Date;
  approved_at: Date | null;
  executed_at: Date | null;
};

export type WorkspaceActionListItem = {
  id: string;
  workspaceId: string;
  createdByUserId: string | null;
  actionType: ActionType;
  title: string;
  description: string | null;
  status: ActionStatus;
  riskLevel: ActionRiskLevel;
  approvalRequired: boolean;
  policyDecision: ActionPolicyDecision;
  policyDecisionSnapshotSummary: ActionPolicyDecisionSnapshotSummary;
  policyEvaluatedAt: string | null;
  idempotencyKey: string | null;
  actionHash: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  executedAt: string | null;
  hasPayload: false;
};

export type WorkspaceActionListResponse = {
  version: '0.6.0';
  phase: string;
  workspaceId: string;
  userRole: string;
  filters: {
    status: ActionStatus | null;
    actionType: ActionType | null;
    riskLevel: ActionRiskLevel | null;
  };
  pagination: {
    limit: number;
    offset: number;
    returned: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
  items: WorkspaceActionListItem[];
  safety: {
    listViewIncludesPayloadJson: false;
    canApproveFromThisEndpoint: false;
    canExecuteFromThisEndpoint: false;
    externalWritesEnabled: false;
    note: string;
  };
};

export type WorkspaceActionDetailRow = WorkspaceActionSummaryRow & {
  payload_json: Record<string, unknown>;
};

export type WorkspaceActionPayloadPreview = {
  schemaVersion: string | null;
  actionType: string;
  source: string | null;
  intentSummary: string | null;
  dataKeys: string[];
  preview: Record<string, unknown>;
  redactedFields: string[];
  includesFullPayloadJson: false;
  note: string;
};

export type WorkspaceActionEventRow = {
  id: string;
  action_id: string;
  workspace_id: string;
  actor_user_id: string | null;
  event_type: string;
  from_status: ActionStatus | null;
  to_status: ActionStatus | null;
  message: string | null;
  metadata_json: Record<string, unknown>;
  created_at: Date;
};

export type WorkspaceActionStatusHistoryItem = {
  id: string;
  eventType: string;
  fromStatus: ActionStatus | null;
  toStatus: ActionStatus | null;
  actorUserId: string | null;
  message: string | null;
  metadataPreview: Record<string, unknown>;
  createdAt: string;
};

export type WorkspaceActionResultRow = {
  id: string;
  action_id: string;
  workspace_id: string;
  executor_name: string;
  external_id: string | null;
  external_url: string | null;
  result_status: string;
  result_summary: string | null;
  error_message: string | null;
  rollback_supported: boolean;
  rollback_payload: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type WorkspaceActionResultSummaryItem = {
  id: string;
  executorName: string;
  resultStatus: string;
  resultSummary: string | null;
  errorMessage: string | null;
  externalId: string | null;
  externalUrl: string | null;
  rollbackSupported: boolean;
  rollbackPayloadIncluded: false;
  metadataPreview: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceActionDetailResponse = {
  version: '0.6.0';
  phase: string;
  workspaceId: string;
  userRole: string;
  action: Omit<WorkspaceActionListItem, 'hasPayload'> & {
    hasPayload: true;
  };
  payloadPreview: WorkspaceActionPayloadPreview;
  risk: {
    level: ActionRiskLevel;
    approvalRequired: boolean;
    canCurrentRoleApproveInFuture: boolean;
    note: string;
  };
  policy: {
    decision: ActionPolicyDecision;
    evaluatedAt: string | null;
    decisionSnapshot: ActionPolicyDecisionSnapshotSummary;
    fullDecisionSnapshotForAudit: ActionPolicyDecisionSnapshot;
    note: string;
  };
  statusHistory: WorkspaceActionStatusHistoryItem[];
  resultSummary: WorkspaceActionResultSummaryItem[];
  safety: {
    detailIncludesFullPayloadJson: false;
    canApproveFromThisEndpoint: false;
    canExecuteFromThisEndpoint: false;
    externalWritesEnabled: false;
    note: string;
  };
};


export type ApproveWorkspaceActionRow = WorkspaceActionSummaryRow & {
  previous_status: ActionStatus;
};

export type ApproveActionInput = {
  workspaceId: string;
  userId: string;
  actionId: string;
  approvalNote?: string | null;
};

export type ApproveActionResponse = {
  version: '0.6.0';
  phase: string;
  workspaceId: string;
  userRole: string;
  approved: boolean;
  alreadyApproved: boolean;
  action: WorkspaceActionListItem;
  transition: {
    fromStatus: ActionStatus;
    toStatus: 'approved';
  };
  approval: {
    approvedByUserId: string;
    approvedAt: string | null;
    approvalNote: string | null;
    eventLogged: boolean;
  };
  execution: {
    executed: false;
    queued: false;
    executorEnabled: false;
    note: string;
  };
  safety: {
    canExecuteFromThisEndpoint: false;
    externalWritesEnabled: false;
    note: string;
  };
};

export type WorkspaceActionListFilters = {
  status?: ActionStatus;
  actionType?: ActionType;
  riskLevel?: ActionRiskLevel;
  limit?: number;
  offset?: number;
};


export type CreateProposedActionInput = {
  workspaceId: string;
  createdByUserId?: string | null;
  actionType: ActionType;
  title: string;
  description?: string | null;
  payloadJson: Record<string, unknown>;
  riskLevel?: ActionRiskLevel;
  approvalRequired?: boolean;
  policyDecision?: ActionPolicyDecision;
  idempotencyKey?: string | null;
  actionHash?: string | null;
  source?: 'chat' | 'draft_content' | 'draft_support_reply' | 'worker' | 'future_ad_tool' | 'proactive_scheduler' | 'system' | string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateProposedActionDbInput = {
  workspaceId: string;
  createdByUserId: string | null;
  actionType: ActionType;
  title: string;
  description: string | null;
  payloadJson: Record<string, unknown>;
  status: 'proposed';
  riskLevel: ActionRiskLevel;
  approvalRequired: boolean;
  policyDecision: ActionPolicyDecision;
  policyDecisionSnapshotJson: ActionPolicyDecisionSnapshot;
  policyEvaluatedAt: string | null;
  idempotencyKey: string;
  actionHash: string;
};

export type ExistingActionDuplicateRow = {
  id: string;
  workspace_id: string;
  created_by_user_id: string | null;
  action_type: ActionType;
  title: string;
  description: string | null;
  status: ActionStatus;
  risk_level: ActionRiskLevel;
  approval_required: boolean;
  policy_decision: ActionPolicyDecision;
  policy_decision_snapshot_json: ActionPolicyDecisionSnapshot;
  policy_evaluated_at: Date | null;
  idempotency_key: string | null;
  action_hash: string | null;
  created_at: Date;
  updated_at: Date;
  approved_at: Date | null;
  executed_at: Date | null;
  duplicate_match_reason: 'idempotency_key' | 'action_hash';
};

export type CreateProposedActionResult = {
  version: '0.6.0';
  phase: string;
  created: boolean;
  duplicateDetected: boolean;
  duplicateReason: 'none' | 'idempotency_key' | 'action_hash';
  action: WorkspaceActionListItem;
  autonomy: {
    pauseAllAutonomy: boolean;
    category: string;
    categoryPaused: boolean;
    autoApprovalAllowed: boolean;
    executorExecutionAllowed: boolean;
    proposedActionCreationAllowed: true;
    manualReviewAllowed: true;
    note: string;
  };
  safety: {
    status: 'proposed';
    approvalRequired: boolean;
    policyDecision: ActionPolicyDecision;
    canExecuteFromThisService: false;
    externalWritesEnabled: false;
    note: string;
  };
};

export type InternalAdminActionMonitorRow = {
  id: string;
  workspace_id: string;
  workspace_name: string | null;
  action_type: ActionType;
  title: string;
  status: ActionStatus;
  risk_level: ActionRiskLevel;
  approval_required: boolean;
  policy_decision: ActionPolicyDecision;
  created_at: Date;
  updated_at: Date;
  latest_result_status: string | null;
};

export type RejectWorkspaceActionRow = WorkspaceActionSummaryRow & {
  previous_status: ActionStatus;
};

export type RejectActionInput = {
  workspaceId: string;
  userId: string;
  actionId: string;
  rejectionReason?: string | null;
};

export type RejectActionResponse = {
  version: '0.6.0';
  phase: string;
  workspaceId: string;
  userRole: string;
  rejected: boolean;
  alreadyRejected: boolean;
  action: WorkspaceActionListItem;
  transition: {
    fromStatus: ActionStatus;
    toStatus: 'rejected';
  };
  rejection: {
    rejectedByUserId: string;
    rejectedAt: string | null;
    rejectionReason: string | null;
    eventLogged: boolean;
  };
  execution: {
    executed: false;
    queued: false;
    executorEnabled: false;
    note: string;
  };
  safety: {
    canExecuteFromThisEndpoint: false;
    externalWritesEnabled: false;
    note: string;
  };
};

export type CancelWorkspaceActionRow = WorkspaceActionSummaryRow & {
  previous_status: ActionStatus;
};

export type CancelActionInput = {
  workspaceId: string;
  userId: string;
  actionId: string;
  cancelReason?: string | null;
};

export type CancelActionResponse = {
  version: '0.6.0';
  phase: string;
  workspaceId: string;
  userRole: string;
  cancelled: boolean;
  alreadyCancelled: boolean;
  action: WorkspaceActionListItem;
  transition: {
    fromStatus: ActionStatus;
    toStatus: 'cancelled';
  };
  cancellation: {
    cancelledByUserId: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    eventLogged: boolean;
  };
  execution: {
    executed: false;
    queued: false;
    executorEnabled: false;
    rollbackRequired: false;
    note: string;
  };
  safety: {
    canExecuteFromThisEndpoint: false;
    externalWritesEnabled: false;
    executedActionsCancellableFromThisEndpoint: false;
    note: string;
  };
};
