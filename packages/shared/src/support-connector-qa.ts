export const SUPPORT_CONNECTOR_QA_PHASE = 'phase_12_10_support_connector_qa';
export const SUPPORT_CONNECTOR_QA_HEALTH_MODE = 'v2-phase-12-10-support-connector-qa';
export const SUPPORT_CONNECTOR_QA_DELIVERABLE = 'support_connector_qa_report';

export const SUPPORT_CONNECTOR_QA_SCENARIOS = [
  'ticket_import',
  'classification',
  'draft_action',
  'no_send_safety',
  'permission_controls',
] as const;

export type SupportConnectorQaScenarioName = typeof SUPPORT_CONNECTOR_QA_SCENARIOS[number];
