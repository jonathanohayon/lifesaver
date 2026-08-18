export const CONTENT_ANOMALY_STOP_SHARED_CONTRACT = {
  phase: 'phase_11_8_anomaly_stop',
  healthMode: 'v2-phase-11-8-anomaly-stop',
  deliverable: 'anomaly_stop_behavior',
  watches: ['api_failure', 'multiple_failures', 'platform_warning', 'cap_exceeded', 'token_expired'],
  safety: {
    anomalyGuardOnly: true,
    doesNotPublish: true,
    doesNotApprove: true,
    externalApiCalled: false,
    noDatabaseWrites: true,
    noPauseMutationInThisPhase: true,
    rawPayloadNotReturned: true,
    tokenNotReturned: true,
  },
} as const;
