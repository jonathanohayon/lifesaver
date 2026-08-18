export const SAFE_DEMO_QA_SHARED_CONTRACT = {
  version: '0.6.0',
  phase: 'v0.6.0 Phase 8.10 Safe Demo QA',
  deliverable: 'Sandbox executor QA report',
  liveDomain: 'https://lifesaveragent.com',
  flow: ['draft', 'proposed_action', 'approval', 'sandbox_execution', 'result_log'],
  safety: {
    sandboxOnly: true,
    externalWritesEnabled: false,
    realExecutorsEnabled: false,
    autoRunEnabled: false,
  },
} as const;

export type SafeDemoQaSharedStep = typeof SAFE_DEMO_QA_SHARED_CONTRACT.flow[number];
