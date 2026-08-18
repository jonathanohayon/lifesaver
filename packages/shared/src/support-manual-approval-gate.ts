export const SUPPORT_MANUAL_APPROVAL_GATE_HEALTH_MODE = 'v2-phase-13-3-manual-approval-first' as const;
export const SUPPORT_MANUAL_APPROVAL_GATE_ACTION_TYPE = 'support_reply_send' as const;
export const SUPPORT_MANUAL_APPROVAL_GATE_POLICY_ID = 'support_send_manual_approval_first_v1' as const;

export type SupportManualApprovalGateDecision =
  | 'approved_to_execute'
  | 'blocked_manual_approval_required'
  | 'blocked_unsupported_action_type'
  | 'blocked_auto_send_not_allowed';
