import type {
  AdBudgetAdjustPayload,
  ContentPublishPayload,
  SupportReplySendPayload,
  V2ActionPayload,
  V2ActionType,
} from './action-payload-schemas.js';

export const ACTION_FIXTURE_SET_VERSION = 'action-fixtures/v0.6.0-phase-2.10' as const;

export type LocalActionFixtureStatus = 'proposed' | 'approval_required';
export type LocalActionFixtureRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LocalActionFixtureDefinition<TPayload extends V2ActionPayload = V2ActionPayload> {
  fixture_key: string;
  title: string;
  description: string;
  action_type: V2ActionType;
  status: LocalActionFixtureStatus;
  risk_level: LocalActionFixtureRiskLevel;
  approval_required: boolean;
  policy_decision: 'ask';
  idempotency_key: string;
  payload_json: TPayload;
  expected_safety: {
    local_only: true;
    external_write_enabled: false;
    executor_enabled: false;
    approval_endpoint_required_before_execution: true;
  };
}

const proposedInstagramPostPayload: ContentPublishPayload = {
  schema_version: 'action-payload/v0.6.0',
  action_type: 'content_publish',
  source: 'system',
  intent_summary: 'Proposed Instagram post fixture for approval queue testing only.',
  created_reason: 'Phase 2.10 local QA fixture. No social platform API call is allowed.',
  risk_notes: ['Local fixture only', 'No executor is registered', 'No platform token is included'],
  idempotency_hint: 'phase-2-10-fixture-instagram-post',
  data: {
    platform: 'instagram',
    caption: 'A calm founder check-in: revenue is moving, ROAS needs attention, and the next step is disciplined optimisation. #ecommerce #founderops',
    post_type: 'image',
    media_url: 'https://example.test/local-fixtures/instagram-post-preview.png',
    hashtags: ['ecommerce', 'founderops', 'lifesaver'],
    scheduled_time: null,
    account_id_hint: 'sandbox-instagram-account',
    call_to_action_url: null,
    approval_notes: 'Fixture only. This must never publish to Instagram unless a future real executor is intentionally built and manually approved.',
  },
};

const proposedSupportReplyPayload: SupportReplySendPayload = {
  schema_version: 'action-payload/v0.6.0',
  action_type: 'support_reply_send',
  source: 'system',
  intent_summary: 'Proposed support reply fixture for approval queue testing only.',
  created_reason: 'Phase 2.10 local QA fixture. No email/helpdesk API call is allowed.',
  risk_notes: ['Local fixture only', 'No send executor is registered', 'Customer email is synthetic'],
  idempotency_hint: 'phase-2-10-fixture-support-reply',
  data: {
    ticket_id: 'fixture-ticket-1001',
    thread_id: 'fixture-thread-1001',
    reply_body: 'Certainly — thank you for reaching out. I have checked the order note and the safest next step is for our team to review the delivery status before making any promise. We will update you shortly.',
    support_provider: 'sandbox_helpdesk',
    customer_email: 'customer.fixture@example.test',
    customer_name: 'Fixture Customer',
    subject: 'Question about order status',
    category: 'shipping',
    confidence_score: 0.82,
    sensitive_flag: false,
    escalation_required: false,
    approval_notes: 'Fixture only. This must never send an email or support message in V1/V2 foundation phases.',
  },
};

const proposedAdBudgetPayload: AdBudgetAdjustPayload = {
  schema_version: 'action-payload/v0.6.0',
  action_type: 'ad_budget_adjust',
  source: 'system',
  intent_summary: 'Proposed Meta ad budget change fixture for approval queue testing only.',
  created_reason: 'Phase 2.10 local QA fixture. No ad platform API call is allowed.',
  risk_notes: ['Local fixture only', 'High risk because it represents money movement', 'No ads executor is registered'],
  idempotency_hint: 'phase-2-10-fixture-ad-budget-adjust',
  data: {
    platform: 'meta_ads',
    campaign_id: 'fixture-campaign-2001',
    current_budget: 100,
    proposed_budget: 85,
    change_amount: -15,
    currency: 'USD',
    account_id_hint: 'sandbox-meta-account',
    current_budget_period: 'daily',
    proposed_budget_period: 'daily',
    change_percent: -15,
    reason: 'Fixture scenario: ROAS softened and the system proposes reducing daily budget by 15%. This is not executable in this phase.',
    metric_window: 'last_24_hours',
    performance_snapshot: {
      roas: 1.55,
      paid_media_spend: 220.95,
      revenue: 342.54,
      orders: 6,
      source: 'synthetic_fixture_values_not_live_data',
    },
    rollback_budget: 100,
    approval_notes: 'Fixture only. Ad spend changes must remain blocked until ads connector, caps, approval, pause, and executor phases are completed.',
  },
};

export const LOCAL_ACTION_FIXTURES: LocalActionFixtureDefinition[] = [
  {
    fixture_key: 'phase_2_10_proposed_instagram_post',
    title: 'Fixture: Proposed Instagram post',
    description: 'Local-only proposed content_publish action for testing future approval queue views. It does not publish anything.',
    action_type: 'content_publish',
    status: 'proposed',
    risk_level: 'low',
    approval_required: true,
    policy_decision: 'ask',
    idempotency_key: 'local-fixture:v0.6.0:phase-2.10:instagram-post',
    payload_json: proposedInstagramPostPayload,
    expected_safety: {
      local_only: true,
      external_write_enabled: false,
      executor_enabled: false,
      approval_endpoint_required_before_execution: true,
    },
  },
  {
    fixture_key: 'phase_2_10_proposed_support_reply',
    title: 'Fixture: Proposed support reply',
    description: 'Local-only proposed support_reply_send action for testing future approval queue views. It does not send anything.',
    action_type: 'support_reply_send',
    status: 'proposed',
    risk_level: 'medium',
    approval_required: true,
    policy_decision: 'ask',
    idempotency_key: 'local-fixture:v0.6.0:phase-2.10:support-reply',
    payload_json: proposedSupportReplyPayload,
    expected_safety: {
      local_only: true,
      external_write_enabled: false,
      executor_enabled: false,
      approval_endpoint_required_before_execution: true,
    },
  },
  {
    fixture_key: 'phase_2_10_proposed_ad_budget_change',
    title: 'Fixture: Proposed ad budget change',
    description: 'Local-only proposed ad_budget_adjust action for testing future approval queue views. It does not change ad spend.',
    action_type: 'ad_budget_adjust',
    status: 'proposed',
    risk_level: 'high',
    approval_required: true,
    policy_decision: 'ask',
    idempotency_key: 'local-fixture:v0.6.0:phase-2.10:ad-budget-adjust',
    payload_json: proposedAdBudgetPayload,
    expected_safety: {
      local_only: true,
      external_write_enabled: false,
      executor_enabled: false,
      approval_endpoint_required_before_execution: true,
    },
  },
];
