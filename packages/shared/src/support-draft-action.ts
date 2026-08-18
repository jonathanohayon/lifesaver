export const SUPPORT_DRAFT_ACTION_PHASE = 'phase_12_5_draft_reply_action' as const;
export const SUPPORT_DRAFT_ACTION_HEALTH_MODE = 'v2-phase-12-5-draft-reply-action' as const;

export type SupportDraftActionProvider = 'gmail';
export type SupportDraftActionDecision = 'proposed_action_ready' | 'manual_review_required' | 'blocked';
export type SupportDraftActionCategory = 'faq' | 'shipping' | 'complaint' | 'refund' | 'cancellation' | 'payment_issue' | 'sensitive' | 'escalation';

export interface SupportDraftToActionInput {
  provider?: SupportDraftActionProvider;
  ticketId: string;
  threadId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  subject?: string | null;
  draftReplyBody?: string | null;
  replyBody?: string | null;
  category?: SupportDraftActionCategory | null;
  confidenceScore?: number | null;
  sensitiveFlag?: boolean;
  escalationRequired?: boolean;
  approvalNotes?: string | null;
  sourceDraftId?: string | null;
  idempotencyHint?: string | null;
}

export interface SupportDraftActionStatus {
  phase: 'V2 Phase 12.5 — Draft Reply Action';
  healthMode: typeof SUPPORT_DRAFT_ACTION_HEALTH_MODE;
  deliverable: 'support_draft_to_action_flow';
  selectedConnector: 'gmail';
  supportReplyActionType: 'support_reply_send';
  draftToActionAdded: true;
  createsProposedAction: true;
  emailSendAdded: false;
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  supportAutoReplyAdded: false;
  rawProviderPayloadReturned: false;
  approvalRequired: true;
}
