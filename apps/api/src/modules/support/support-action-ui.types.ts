import type { ActionRiskLevel } from '../actions/actions.types.js';
import type { SupportClassifierCategory } from './support-ticket-classifier.types.js';

export type SupportActionUiActionStatus = 'proposed' | 'approved' | 'rejected' | 'cancelled' | 'executed' | 'failed' | 'unknown';

export type SupportActionUiInput = {
  ticketId: string;
  threadId?: string | null;
  actionId?: string | null;
  actionStatus?: SupportActionUiActionStatus | null;
  customerEmail?: string | null;
  subject?: string | null;
  bodySnippet?: string | null;
  suggestedReply?: string | null;
  category?: SupportClassifierCategory | null;
  confidenceScore?: number | null;
  sensitiveFlag?: boolean | null;
  escalationRequired?: boolean | null;
  riskLevel?: ActionRiskLevel | null;
};

export type SupportActionUiTicketPreview = {
  ticketId: string;
  threadId: string | null;
  customerEmailHint: string | null;
  subjectPreview: string | null;
  bodySnippetPreview: string | null;
  category: SupportClassifierCategory;
  confidenceScore: number;
  sensitiveFlag: boolean;
  escalationRequired: boolean;
};

export type SupportActionUiReviewControls = {
  actionId: string | null;
  actionStatus: SupportActionUiActionStatus;
  approveEnabled: boolean;
  rejectEnabled: boolean;
  approveEndpoint: string | null;
  rejectEndpoint: string | null;
  approveRequiresConfirmation: true;
  rejectRequiresReason: true;
  opensExistingApprovalQueue: true;
  canSendEmail: false;
  canExecuteSupportSend: false;
};

export type SupportActionUiPreview = {
  valid: true;
  phase: string;
  deliverable: 'support_action_ui';
  selectedConnector: 'gmail';
  actionType: 'support_reply_send';
  ticket: SupportActionUiTicketPreview;
  suggestedReplyPreview: string | null;
  riskLevel: ActionRiskLevel;
  policyDecision: 'ask';
  approvalRequired: true;
  reviewControls: SupportActionUiReviewControls;
  founderReviewChecklist: string[];
  warnings: string[];
  safety: {
    browserSafeOnly: true;
    usesExistingInternalApprovalEndpoints: true;
    approveRejectCanExecuteAction: false;
    emailSent: false;
    gmailApiCalled: false;
    supportSendExecutorAdded: false;
    supportAutoReplyAdded: false;
    rawProviderPayloadReturned: false;
    rawTicketPayloadReturned: false;
  };
};

export type SupportActionUiStatus = {
  phase: string;
  healthMode: string;
  deliverable: 'support_action_ui';
  selectedConnector: 'gmail';
  ticketReviewUiAdded: boolean;
  suggestedReplyReviewAdded: boolean;
  approveRejectControlsAdded: boolean;
  usesExistingInternalApprovalEndpoints: boolean;
  approvalRequiresConfirmation: boolean;
  rejectionRequiresReason: boolean;
  supportSendExecutorAdded: false;
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  emailSendAdded: false;
  supportAutoReplyAdded: false;
  rawProviderPayloadReturned: false;
};

export type SupportActionUiExample = {
  proposedShippingReply: SupportActionUiPreview;
  sensitiveEscalationReply: SupportActionUiPreview;
  approvedReadOnlyState: SupportActionUiPreview;
};
