export type NotificationCenterPendingActionRow = {
  id: string;
  workspace_id: string;
  action_type: string;
  title: string;
  description: string | null;
  status: string;
  risk_level: string;
  approval_required: boolean;
  policy_decision: string;
  created_at: Date;
  updated_at: Date;
};

export type NotificationCenterRecentEventRow = {
  id: string;
  action_id: string;
  workspace_id: string;
  action_type: string;
  action_title: string;
  action_status: string;
  risk_level: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  actor_user_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: Date;
};

export type NotificationCenterPendingApprovalItem = {
  id: string;
  actionId: string;
  title: string;
  description: string | null;
  actionType: string;
  status: string;
  riskLevel: string;
  approvalRequired: boolean;
  policyDecision: string;
  createdAt: string;
  updatedAt: string;
  actionUrl: string;
  priority: 'normal' | 'elevated' | 'urgent';
};

export type NotificationCenterRecentEventItem = {
  id: string;
  actionId: string;
  actionTitle: string;
  actionType: string;
  actionStatus: string;
  riskLevel: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  actorUserId: string | null;
  createdAt: string;
  actionUrl: string;
  metadataPreview: Record<string, unknown>;
};

export type NotificationCenterResponse = {
  version: '0.7.0';
  phase: 'phase_10_2_in_app_notification_center';
  workspaceId: string;
  generatedAt: string;
  counts: {
    pendingApprovals: number;
    recentEvents: number;
    highRiskPendingApprovals: number;
  };
  pendingApprovals: NotificationCenterPendingApprovalItem[];
  recentEvents: NotificationCenterRecentEventItem[];
  preferencesSummary: {
    inAppCenterEnabled: true;
    emailDeliveryImplemented: false;
    slackDeliveryImplemented: false;
    quietHoursEnforcedForUiOnly: false;
  };
  safety: {
    readOnly: true;
    canApproveFromThisEndpoint: false;
    canExecuteFromThisEndpoint: false;
    sendsEmailInThisPhase: false;
    sendsSlackInThisPhase: false;
    callsExternalServices: false;
    exposesActionPayloadJson: false;
    exposesTokensOrSecrets: false;
    note: string;
  };
};
