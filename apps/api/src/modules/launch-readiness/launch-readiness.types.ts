export type LaunchCheckSeverity = 'critical' | 'warning' | 'info';

export type LaunchCheck = {
  key: string;
  label: string;
  ok: boolean;
  severity: LaunchCheckSeverity;
  message: string;
};

export type LaunchReadinessPayload = {
  version: string;
  mode: string;
  customerAccessMode: string;
  domainDeploymentMode: string;
  launchDomainLabel: string;
  readyForLocalCustomerTesting: boolean;
  readyForProductionCustomerTraffic: boolean;
  criticalFailures: number;
  warnings: number;
  configuredUrls: {
    publicSiteUrl: string;
    appUrl: string;
    adminUrl: string;
    apiUrl: string;
    workerApiBaseUrl: string;
  };
  productionEnvTemplate: Record<string, string>;
  checklist: LaunchCheck[];
  customerFlow: string[];
  adminFlow: string[];
  blockedUntilReady: string[];
  safetyRules: string[];
};
