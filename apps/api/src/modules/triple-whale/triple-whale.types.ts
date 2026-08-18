import type { NormalizedMetrics } from '../metrics/metrics.types.js';

export type TripleWhaleSyncResult = {
  success: true;
  mode: 'validated_skeleton' | 'summary_probe';
  verification: 'api_key_validated' | 'summary_probe_attempted';
  message: string;
  snapshotId: string;
  dateRange: string;
  provider: 'triple_whale';
  normalizedMetrics: NormalizedMetrics;
  rawPayloadPreview: Record<string, unknown>;
};

export type TripleWhaleLiveVerificationResult = {
  success: boolean;
  mode: 'api_key_validation';
  message: string;
  httpStatus: number | null;
  responseKind: string;
  responsePreview: unknown;
  safeNote: string;
};
