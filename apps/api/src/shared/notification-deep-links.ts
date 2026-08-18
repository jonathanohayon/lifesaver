export const APPROVAL_DEEP_LINKS_PHASE = 'phase_10_4_approval_deep_links' as const;
export const APPROVAL_DEEP_LINKS_VERSION = '0.7.0' as const;

export type SharedApprovalDeepLinkSafety = {
  containsToken: false;
  containsSecret: false;
  exposesPayloadJson: false;
  canApproveByLinkAlone: false;
  canExecuteByLinkAlone: false;
  requiresAuthenticatedSession: true;
};
