export type BriefType = 'daily' | 'weekly';

export interface BriefResponse {
  type: BriefType;
  content: string;
  source: 'database' | 'generated_from_metrics' | 'generated_from_live_metrics' | 'mock';
  sourceSnapshotId: string | null;
  generatedAt: string;
  sourceStatus?: string;
  productionReady?: boolean;
  metadata?: Record<string, unknown>;
}

export interface WeeklySummaryResponse extends BriefResponse {
  metrics: {
    revenue: number;
    orders: number;
    aov: number;
    adSpend: number;
    roas: number;
    conversionRate: number;
  };
}

export type BriefRow = {
  id: string;
  workspace_id: string;
  type: BriefType;
  source_snapshot_id: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};
