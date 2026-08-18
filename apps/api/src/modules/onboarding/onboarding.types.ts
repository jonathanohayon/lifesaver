export type OnboardingStep = {
  key: string;
  title: string;
  description: string;
  completed: boolean;
  actionLabel: string;
  actionUrl: string;
};

export type OnboardingStatus = {
  workspace: {
    id: string;
    name: string;
    slug: string | null;
    planKey: string;
    status: string;
    onboardingStatus: string;
    onboardingCompletedAt: string | null;
  };
  progress: {
    completedSteps: number;
    totalSteps: number;
    percent: number;
    readyForDashboard: boolean;
  };
  flags: {
    hasTripleWhaleConnection: boolean;
    hasMetricsSnapshot: boolean;
    hasDailyBrief: boolean;
    hasWeeklySummary: boolean;
  };
  steps: OnboardingStep[];
  recommendedNextStep: OnboardingStep | null;
  safetyMode: 'read_advise_draft_only';
  message: string;
};
