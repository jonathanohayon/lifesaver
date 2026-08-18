import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { createProposedAction } from '../actions/actions.service.js';
import type { SupportDraftActionCreateResult } from './support-draft-action.types.js';
import { buildSupportDraftActionPreview } from './support-draft-action.model.js';

export function previewSupportDraftAction(input: unknown) {
  return buildSupportDraftActionPreview(input);
}

export async function createSupportDraftProposedAction(params: {
  workspaceId: string;
  userId: string;
  input: unknown;
}): Promise<SupportDraftActionCreateResult> {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to create a proposed support reply action.');
  }

  const preview = buildSupportDraftActionPreview(params.input);
  const actionResult = await createProposedAction({
    workspaceId: params.workspaceId,
    createdByUserId: params.userId,
    actionType: 'support_reply_send',
    title: preview.title,
    description: preview.description,
    payloadJson: preview.payload as unknown as Record<string, unknown>,
    riskLevel: preview.riskLevel,
    approvalRequired: true,
    policyDecision: 'ask',
    idempotencyKey: preview.payload.idempotency_hint,
    source: 'phase_12_5_support_draft_to_action',
    reason: 'Support draft converted to a proposed support_reply_send action. No email was sent and no Gmail API call was made.',
    metadata: {
      phase: '12.5',
      support_draft_to_action: true,
      email_sent: false,
      gmail_api_called: false,
      external_write_enabled: false,
      auto_reply_enabled: false,
      source_draft_id: preview.browserSafePreview.sourceDraftId,
      ticket_id: preview.browserSafePreview.ticketId,
      category: preview.browserSafePreview.category,
      sensitive_flag: preview.browserSafePreview.sensitiveFlag,
      escalation_required: preview.browserSafePreview.escalationRequired,
    },
  });

  return {
    proposedActionCreated: true,
    actionResult,
    preview,
    safety: {
      ...preview.safety,
      createEndpointCanSendEmail: false,
      createEndpointCanCallGmail: false,
    },
  };
}
