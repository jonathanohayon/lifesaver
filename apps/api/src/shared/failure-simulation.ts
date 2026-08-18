export const FAILURE_SIMULATION_SHARED_PHASE = 'v0.6.0 Phase 8.8 Failure Simulation' as const;

export type SandboxFailureFlagLocation = 'payload_root' | 'payload_data' | 'metadata';

export type SandboxFailureSimulationContract = {
  version: '0.6.0';
  phase: typeof FAILURE_SIMULATION_SHARED_PHASE;
  flag: 'sandbox_should_fail';
  acceptedLocations: SandboxFailureFlagLocation[];
  expectedFinalStatus: 'failed';
  resultStatus: 'failed';
  sandboxOnly: true;
  externalWritesAttempted: false;
  externalWritesSucceeded: false;
};

export function getSandboxFailureSimulationContract(): SandboxFailureSimulationContract {
  return {
    version: '0.6.0',
    phase: FAILURE_SIMULATION_SHARED_PHASE,
    flag: 'sandbox_should_fail',
    acceptedLocations: ['payload_root', 'payload_data', 'metadata'],
    expectedFinalStatus: 'failed',
    resultStatus: 'failed',
    sandboxOnly: true,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
  };
}
