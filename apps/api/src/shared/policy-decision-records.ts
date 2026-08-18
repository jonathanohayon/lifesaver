export const POLICY_DECISION_RECORDS_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export const POLICY_DECISION_RECORDS_FIELDS = [
  'decision',
  'reason',
  'matched_policy_id',
  'cap_status',
  'checkedPolicyCount',
  'matchState',
  'defaultAskApplied',
  'approvalRequired',
  'autoApprovalAllowed',
  'pause',
  'capSummary',
  'scopeSummary',
  'conditionSummary',
  'conflictSummary',
  'evaluatedAt',
  'recordedAt',
] as const;

export const POLICY_DECISION_RECORDS_SAFETY_RULES = [
  'Persist policy decision snapshots on the internal actions table for later audit explanation.',
  'Store safe evaluator explanation data only; do not store raw API keys, OAuth tokens, passwords, .env values, or unnecessary sensitive customer data.',
  'Persisting the snapshot does not approve, queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write to external platforms.',
  'Policy decision records support future audit screens explaining why an action required approval, was blocked, or became eligible for auto-approval.',
] as const;

export type PolicyDecisionRecordsContract = {
  version: '0.6.0';
  phase: typeof POLICY_DECISION_RECORDS_PHASE;
  storage: {
    table: 'actions';
    snapshotColumn: 'policy_decision_snapshot_json';
    evaluatedAtColumn: 'policy_evaluated_at';
  };
  safeFields: typeof POLICY_DECISION_RECORDS_FIELDS;
  executorEnabled: false;
  externalWritesEnabled: false;
  safetyRules: typeof POLICY_DECISION_RECORDS_SAFETY_RULES;
};

export const POLICY_DECISION_RECORDS_CONTRACT: PolicyDecisionRecordsContract = {
  version: '0.6.0',
  phase: POLICY_DECISION_RECORDS_PHASE,
  storage: {
    table: 'actions',
    snapshotColumn: 'policy_decision_snapshot_json',
    evaluatedAtColumn: 'policy_evaluated_at',
  },
  safeFields: POLICY_DECISION_RECORDS_FIELDS,
  executorEnabled: false,
  externalWritesEnabled: false,
  safetyRules: POLICY_DECISION_RECORDS_SAFETY_RULES,
};
