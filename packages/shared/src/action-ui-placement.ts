export const ACTION_UI_PLACEMENT_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_UI_PRIMARY_SURFACE = 'actions.html' as const;
export const ACTION_UI_SECONDARY_SURFACE = 'dashboard_preview_panel' as const;

export const ACTION_UI_PLACEMENT_DECISION = {
  phase: ACTION_UI_PLACEMENT_PHASE,
  primarySurface: ACTION_UI_PRIMARY_SURFACE,
  secondarySurface: ACTION_UI_SECONDARY_SURFACE,
  adminSurface: 'redacted_monitoring_later',
  settingsSurface: 'rules_and_preferences_later',
  safety: {
    externalWritesEnabled: false,
    executorEnabled: false,
    approvalExecutesAction: false,
  },
  nextPhase: 'Phase 4.10 — UI QA + Accessibility Pass',
} as const;
