import type { ActionRiskLevel } from '../actions/actions.types.js';
import type { SupportClassifierCategory } from './support-ticket-classifier.types.js';

export type SupportDraftActionProvider = 'gmail';
export type SupportDraftActionDecision = 'proposed_action_ready' | 'manual_review_required' | 'blocked';

export interface SupportDraftToActionInput {
  provider?: SupportDraftActionProvider;
  ticketId: string;
  threadId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  subject?: string | null;
  draftReplyBody?: string | null;
  replyBody?: string | null;
  category?: SupportClassifierCategory | null;
  confidenceScore?: number | null;
  sensitiveFlag?: boolean;
  escalationRequired?: boolean;
  approvalNotes?: string | null;
  sourceDraftId?: string | null;
  idempotencyHint?: string | null;
}

export interface SupportReplyActionPayload {
  action_type: 'support_reply_send';
  schema_version: 'support_reply_send.v1';
  source: 'support_draft_to_action';
  intent_summary: string;
  idempotency_hint: string;
  data: {
    support_provider: SupportDraftActionProvider;
    ticket_id: string;
    thread_id: string;
    reply_body: string;
    customer_email?: string;
    customer_name?: string;
    subject?: string;
    category: SupportClassifierCategory;
    confidence_score: number;
    sensitive_flag: boolean;
    escalation_required: boolean;
    approval_notes?: string;
    source_draft_id?: string;
    send_email_enabled: false;
    external_api_called: false;
    auto_reply_enabled: false;
  };
}

export interface SupportDraftActionPreview {
  valid: true;
  decision: SupportDraftActionDecision;
  title: string;
  description: string;
  riskLevel: ActionRiskLevel;
  actionType: 'support_reply_send';
  approvalRequired: true;
  policyDecision: 'ask';
  payload: SupportReplyActionPayload;
  browserSafePreview: {
    provider: SupportDraftActionProvider;
    ticketId: string;
    threadId: string;
    customerEmailHint: string | null;
    subjectPreview: string | null;
    replyBodyPreview: string;
    category: SupportClassifierCategory;
    confidenceScore: number;
    sensitiveFlag: boolean;
    escalationRequired: boolean;
    sourceDraftId: string | null;
  };
  safety: {
    createsProposedActionOnly: true;
    emailSent: false;
    gmailApiCalled: false;
    externalWriteEnabled: false;
    autoReplyEnabled: false;
    rawProviderPayloadReturned: false;
  };
  warnings: string[];
}

export interface SupportDraftActionCreateResult {
  proposedActionCreated: boolean;
  actionResult: unknown;
  preview: SupportDraftActionPreview;
  safety: SupportDraftActionPreview['safety'] & {
    createEndpointCanSendEmail: false;
    createEndpointCanCallGmail: false;
  };
}

export interface SupportDraftActionStatus {
  phase: 'V2 Phase 12.5 — Draft Reply Action';
  healthMode: 'v2-phase-12-5-draft-reply-action';
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
