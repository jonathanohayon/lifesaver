export type ContentActionDigestSourceStatus =
  | 'executed'
  | 'published'
  | 'rolled_back'
  | 'proposed'
  | 'approved'
  | 'pending_approval'
  | 'failed'
  | 'blocked'
  | 'cancelled'
  | string;

export type ContentActionDigestEntryInput = {
  actionId: string;
  title: string;
  actionType?: 'content_publish' | string;
  platform?: 'linkedin' | string;
  channel?: 'linkedin_member_feed' | string;
  status: ContentActionDigestSourceStatus;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | string;
  createdAt?: string;
  approvedAt?: string;
  publishedAt?: string;
  failedAt?: string;
  permalink?: string | null;
  platformPostId?: string | null;
  reason?: string;
  publishReason?: string;
  approvalReason?: string;
  failureReason?: string;
  autoApprovalDecision?: 'auto_approved' | 'manual_review_required' | 'blocked' | string;
  finalValidationDecision?: 'ready_for_executor_handoff' | 'blocked_before_publish' | string;
};

export type ContentActionDigestInput = {
  workspaceId?: string;
  digestDate?: string;
  timezone?: string;
  actions: ContentActionDigestEntryInput[];
};

export type ContentActionDigestBucketEntry = {
  actionId: string;
  title: string;
  actionType: string;
  platform: string;
  channel: string;
  riskLevel: string;
  status: ContentActionDigestSourceStatus;
  timestamp: string | null;
  reason: string;
  safeLinkAvailable: boolean;
  permalink?: string;
};

export type ContentActionDigestResult = {
  phase: 'phase_11_7_daily_action_digest';
  healthMode: 'v2-phase-11-7-daily-action-digest';
  deliverable: 'content_action_digest';
  digestDate: string;
  timezone: string;
  scope: {
    workspaceScoped: true;
    contentOnly: true;
    supportedPlatform: 'linkedin';
    supportedChannel: 'linkedin_member_feed';
  };
  counts: {
    totalInputActions: number;
    published: number;
    waitingForApproval: number;
    failed: number;
    ignoredNonContentActions: number;
  };
  published: ContentActionDigestBucketEntry[];
  waitingForApproval: ContentActionDigestBucketEntry[];
  failed: ContentActionDigestBucketEntry[];
  dailyBriefSection: {
    heading: string;
    summary: string;
    bulletLines: string[];
  };
  safety: {
    digestOnly: true;
    doesNotPublish: true;
    doesNotApprove: true;
    doesNotNotify: true;
    externalApiCalled: false;
    noDatabaseWrites: true;
    rawPayloadNotReturned: true;
    tokenNotReturned: true;
    secretsNotReturned: true;
  };
};

export type ContentActionDigestStatus = {
  phase: ContentActionDigestResult['phase'];
  healthMode: ContentActionDigestResult['healthMode'];
  enabled: true;
  deliverable: ContentActionDigestResult['deliverable'];
  purpose: 'daily_brief_content_action_digest';
  reports: ['what_was_published', 'why_it_was_published', 'what_is_waiting_for_approval', 'what_failed'];
  safety: ContentActionDigestResult['safety'];
};
