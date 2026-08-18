export const ACTION_RISK_BADGE_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export type ActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ActionRiskBadgeDefinition = {
  level: ActionRiskLevel;
  label: string;
  tone: 'calm' | 'caution' | 'warning' | 'critical';
  founderMessage: string;
  approvalGuidance: string;
};

export const ACTION_RISK_BADGES: Record<ActionRiskLevel, ActionRiskBadgeDefinition> = {
  low: {
    level: 'low',
    label: 'Low Risk',
    tone: 'calm',
    founderMessage: 'Routine internal action. Still review before approval.',
    approvalGuidance: 'Owner/admin may approve if the content/context is correct.',
  },
  medium: {
    level: 'medium',
    label: 'Medium Risk',
    tone: 'caution',
    founderMessage: 'Needs careful review. Check brand, timing, and customer context.',
    approvalGuidance: 'Owner/admin approval only. Reject with reason if uncertain.',
  },
  high: {
    level: 'high',
    label: 'High Risk',
    tone: 'warning',
    founderMessage: 'High-impact action. Review payload, platform, and business effect carefully.',
    approvalGuidance: 'Owner/admin approval only. Do not approve if data is incomplete.',
  },
  critical: {
    level: 'critical',
    label: 'Critical Risk',
    tone: 'critical',
    founderMessage: 'Critical action. Founder-level scrutiny is required before any future execution phase.',
    approvalGuidance: 'Owner approval should be required by default. Never auto-run without explicit hard policy and caps.',
  },
};

export const CRITICAL_ACTION_WARNING_TRIGGERS = [
  'Ad spend changes',
  'Bulk support sends',
  'Refund-related replies',
  'Unusual customer complaints',
] as const;

export const CRITICAL_BY_DEFAULT_ACTION_TYPES = [
  'ad_budget_adjust',
  'ad_pause',
] as const;

export function normalizeActionRiskLevel(value: string | null | undefined): ActionRiskLevel {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') return value;
  return 'medium';
}

export function getActionRiskBadgeDefinition(value: string | null | undefined): ActionRiskBadgeDefinition {
  return ACTION_RISK_BADGES[normalizeActionRiskLevel(value)];
}
