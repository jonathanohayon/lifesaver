export const ACTION_UI_QA_ACCESSIBILITY_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_UI_QA_ACCESSIBILITY_CHECKS = [
  'Loading states are visible and announced through aria-busy / live status text.',
  'Empty states explain that no workspace actions match the current filters.',
  'Error states are safe, visible, and include no secrets.',
  'Keyboard focus states are visible on links, buttons, selects, textareas, dialogs, and skip link.',
  'Keyboard users can open detail, approval, and rejection dialogs and close them with Escape.',
  'Dialog focus is kept inside the active drawer/modal while it is open.',
  'Text readability is improved with safer line-height and overflow wrapping.',
  'Responsive layout avoids horizontal overflow on small phone widths.'
] as const;

export const ACTION_UI_QA_ACCESSIBILITY_BOUNDARY = {
  allowed: [
    'UI-only accessibility polish',
    'safe loading, empty, and error states',
    'focus-visible styling',
    'skip link',
    'dialog aria labels/descriptions',
    'dialog focus trap',
    'overflow-safe responsive layout',
    'QA documentation/reporting'
  ],
  forbidden: [
    'executor registry',
    'sandbox executor',
    'real executor',
    'content publishing',
    'support sending',
    'ad budget changes',
    'campaign pause',
    'rollback execution',
    'external platform writes'
  ]
} as const;

export type ActionUiQaAccessibilityCheck = typeof ACTION_UI_QA_ACCESSIBILITY_CHECKS[number];
