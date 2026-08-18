export const SUPPORT_WRITE_SCOPE_DELIVERABLE = 'support_write_scope_checklist';
export const SUPPORT_WRITE_SCOPE_HEALTH_MODE = 'v2-phase-13-1-write-scope-setup';
export const SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const SUPPORT_WRITE_SCOPE_EXISTING_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export const SUPPORT_WRITE_SCOPE_BLOCKED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://mail.google.com/',
] as const;

export const SUPPORT_WRITE_SCOPE_FIRST_EXECUTOR_RULES = [
  'approved_support_reply_send_actions_only',
  'no_auto_reply_initially',
  'no_attachments_initially',
  'no_cc_bcc_initially',
  'privacy_redaction_required',
  'escalation_rules_required',
] as const;
