export const ACTION_BACKEND_TEST_PHASE = 'v0.6.0 Phase 3.10 Backend Tests' as const;

export const ACTION_BACKEND_TEST_COVERAGE = [
  'list actions',
  'get action detail',
  'approve action',
  'reject action',
  'cancel action',
  'invalid transition',
  'permission denial',
  'workspace isolation',
] as const;

export type ActionBackendTestStatus = 'pass' | 'fail' | 'skip';

export type ActionBackendTestResult = {
  name: string;
  status: ActionBackendTestStatus;
  message: string;
  details?: Record<string, unknown>;
};

export type ActionBackendTestReport = {
  success: boolean;
  version: '0.6.0';
  phase: '3.10';
  title: 'Phase 3.10 Backend Tests';
  databaseConfigured: boolean;
  safeLocalMode: boolean | null;
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  tests: ActionBackendTestResult[];
  safety: {
    externalWritesEnabled: false;
    executorEnabled: false;
    noPublishing: true;
    noSupportSending: true;
    noAdSpendChanges: true;
    noCampaignPause: true;
    cleanupDefault: boolean;
    note: string;
  };
};

export const ACTION_BACKEND_TEST_SAFETY_NOTES = [
  'Backend tests are local/non-production only by default.',
  'The database integration runner creates temporary test data and cleans it up by default.',
  'The test command does not call social platforms, helpdesks, ad platforms, Shopify, Triple Whale write APIs, or any executor.',
  'Approval/rejection/cancellation tested in Phase 3.10 only changes internal action status and logs events.',
] as const;
