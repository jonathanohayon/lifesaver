import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_ESCALATION_RULES_HEALTH_MODE,
  SUPPORT_ESCALATION_RULES_PACKAGE,
  SUPPORT_ESCALATION_RULES_PHASE,
  assertSupportEscalationRulesSafe,
  buildSupportEscalationRulesExample,
  buildSupportEscalationRulesPreview,
  buildSupportEscalationRulesStatus,
  evaluateSupportEscalationRules,
  supportAlwaysEscalateRuleIds,
} from './support-escalation-rules.model.js';

const baseTicket = {
  ticketId: 'ticket_123',
  threadId: 'gmail_thread_123',
  customerEmail: 'customer@example.com',
  subject: 'Question about shipping',
  bodySnippet: 'Can you send tracking?',
  category: 'shipping',
  sensitiveFlag: false,
  classifierConfidence: 0.88,
};

test('Phase 12.7 constants are correct', () => {
  assert.equal(SUPPORT_ESCALATION_RULES_PHASE, 'phase_12_7_escalation_rules');
  assert.equal(SUPPORT_ESCALATION_RULES_HEALTH_MODE, 'v2-phase-12-7-escalation-rules');
  assert.equal(SUPPORT_ESCALATION_RULES_PACKAGE, 'lifesaver-v0.7.0-phase-12-7-escalation-rules.zip');
});

test('status confirms escalation logic and no Gmail/send/action execution', () => {
  const status = buildSupportEscalationRulesStatus();
  assert.equal(status.deliverable, 'support_escalation_logic');
  assert.equal(status.selectedConnector, 'gmail');
  assert.equal(status.escalationLogicAdded, true);
  assert.equal(status.highValueCustomerEscalatesOnlyIfConfigured, true);
  assert.equal(status.privacySafeguardsApplied, true);
  assert.equal(status.gmailApiClientAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.supportAutoReplyAdded, false);
  assert.equal(status.supportReplyActionCreated, false);
});

test('always escalate rule list contains all requested rules', () => {
  assert.deepEqual(supportAlwaysEscalateRuleIds.sort(), [
    'refund_request',
    'legal_threat',
    'chargeback',
    'angry_complaint',
    'uncertain_answer',
    'medical_or_sensitive_content',
    'classifier_escalation_category',
    'classifier_sensitive_flag',
    'high_value_customer_configured',
  ].sort());
});

test('refund requests escalate', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, category: 'refund', subject: 'Refund please', bodySnippet: 'I want my money back.' });
  assert.equal(result.escalationRequired, true);
  assert.equal(result.decision, 'escalate_to_founder');
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'refund_request'));
});

test('legal threats escalate', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, subject: 'Legal action', bodySnippet: 'I will call my lawyer and sue you.' });
  assert.equal(result.escalationRequired, true);
  assert.equal(result.severity, 'critical');
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'legal_threat'));
});

test('chargebacks escalate', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, subject: 'Chargeback', bodySnippet: 'I will dispute this charge with my bank.' });
  assert.equal(result.escalationRequired, true);
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'chargeback'));
});

test('angry complaints escalate', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, category: 'complaint', subject: 'Terrible experience', bodySnippet: 'I am angry and this was the worst service.' });
  assert.equal(result.escalationRequired, true);
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'angry_complaint'));
});

test('uncertain answers escalate when draft reply is unsure', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, draftReply: 'I am not sure, but maybe the order shipped.' });
  assert.equal(result.escalationRequired, true);
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'uncertain_answer'));
});

test('uncertain answers escalate when explicit flag is true', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, answerUncertain: true });
  assert.equal(result.escalationRequired, true);
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'uncertain_answer'));
});

test('low classifier confidence escalates as uncertain answer', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, classifierConfidence: 0.41 });
  assert.equal(result.escalationRequired, true);
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'uncertain_answer'));
});

test('medical and sensitive content escalates to sensitive review', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, subject: 'Allergic reaction', bodySnippet: 'I had a medical reaction and went to hospital.' });
  assert.equal(result.escalationRequired, true);
  assert.equal(result.suggestedQueue, 'sensitive_review');
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'medical_or_sensitive_content'));
});

test('classifier sensitive flag escalates to sensitive review', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, sensitiveFlag: true });
  assert.equal(result.escalationRequired, true);
  assert.equal(result.suggestedQueue, 'sensitive_review');
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'classifier_sensitive_flag'));
});

test('classifier escalation category escalates', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, category: 'escalation' });
  assert.equal(result.escalationRequired, true);
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'classifier_escalation_category'));
});

test('high-value customer does not escalate unless configured', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, highValueCustomer: true, highValueCustomerEscalationEnabled: false });
  assert.equal(result.escalationRequired, false);
  assert.equal(result.suggestedQueue, 'standard_support');
});

test('high-value customer escalates when configured', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, highValueCustomer: true, highValueCustomerEscalationEnabled: true });
  assert.equal(result.escalationRequired, true);
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'high_value_customer_configured'));
});

test('high-value customer can be inferred from configured LTV threshold', () => {
  const result = evaluateSupportEscalationRules({ ...baseTicket, highValueCustomerEscalationEnabled: true, customerLifetimeValueCents: 125000, highValueThresholdCents: 100000 });
  assert.equal(result.escalationRequired, true);
  assert.ok(result.matchedRules.some((rule) => rule.ruleId === 'high_value_customer_configured'));
});

test('normal shipping ticket does not escalate', () => {
  const result = evaluateSupportEscalationRules(baseTicket);
  assert.equal(result.escalationRequired, false);
  assert.equal(result.decision, 'no_escalation_required');
  assert.equal(result.emailSent, false);
  assert.equal(result.externalApiCalled, false);
  assert.equal(result.supportReplyActionCreated, false);
});

test('privacy safeguards redact email/card-like data in browser-safe previews', () => {
  const result = evaluateSupportEscalationRules({
    ...baseTicket,
    customerEmail: 'private.customer@example.com',
    subject: 'Refund for card 4242 4242 4242 4242',
    bodySnippet: 'My email is private.customer@example.com and I want a refund.',
  });
  assert.equal(result.rawTicketPayloadReturned, false);
  assert.equal(result.fullBodyReturned, false);
  assert.equal(result.customerEmailHint, 'pr***@example.com');
  assert.ok(result.subjectPreview?.includes('[REDACTED_CARD]'));
  assert.ok(result.bodySnippetPreview?.includes('[REDACTED_EMAIL]'));
  assertSupportEscalationRulesSafe(result);
});

test('example and preview builders are safe', () => {
  const example = buildSupportEscalationRulesExample();
  assert.equal(example.result.escalationRequired, true);
  assert.equal(example.result.emailSent, false);
  assert.doesNotThrow(() => assertSupportEscalationRulesSafe(example));

  const preview = buildSupportEscalationRulesPreview(baseTicket);
  assert.equal(preview.valid, true);
  assert.equal(preview.result.safeForBrowser, true);
  assert.doesNotThrow(() => assertSupportEscalationRulesSafe(preview));
});

test('safe output guard blocks secret fragments', () => {
  assert.throws(() => assertSupportEscalationRulesSafe({ token: 'access_token=abc' }), /forbidden fragment/);
});
