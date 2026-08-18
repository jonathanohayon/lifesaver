export const CONTENT_AUTO_RUN_QA_SHARED = {
  phase: 'phase_11_10_auto_run_qa',
  healthMode: 'v2-phase-11-10-auto-run-qa',
  deliverable: 'safe_content_auto_run_qa',
  endpointStatus: 'GET /api/v1/content-auto-run/qa/status',
  endpointReport: 'GET /api/v1/content-auto-run/qa/report',
  approvalPhrase: 'I APPROVE ONE CONTROLLED CONTENT AUTO-RUN TEST',
  safety: {
    reportOnly: true,
    noPublish: true,
    noExternalApiCall: true,
    noDatabaseWrite: true,
  },
} as const;
