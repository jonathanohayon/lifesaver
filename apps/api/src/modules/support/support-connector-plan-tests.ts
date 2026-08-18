import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SELECTED_SUPPORT_CONNECTOR,
  SELECTED_SUPPORT_CONNECTOR_LABEL,
  SUPPORT_CONNECTOR_PLAN_HEALTH_MODE,
  SUPPORT_CONNECTOR_PLAN_PHASE,
  assertSupportConnectorPlanSafe,
  buildSelectedSupportConnectorPlan,
  buildSupportConnectorComparison,
  buildSupportConnectorPlanStatus,
  buildSupportConnectorSafetyPlan,
} from './support-connector-plan.model.js';

test('Phase 12.1 constants are correct', () => {
  assert.equal(SUPPORT_CONNECTOR_PLAN_PHASE, 'phase_12_1_choose_support_connector');
  assert.equal(SUPPORT_CONNECTOR_PLAN_HEALTH_MODE, 'v2-phase-12-1-choose-support-connector');
  assert.equal(SELECTED_SUPPORT_CONNECTOR, 'gmail');
  assert.equal(SELECTED_SUPPORT_CONNECTOR_LABEL, 'Gmail');
});

test('Gmail is selected as first support connector', () => {
  const plan = buildSelectedSupportConnectorPlan();
  assert.equal(plan.selectedConnector, 'gmail');
  assert.equal(plan.selectedConnectorLabel, 'Gmail');
  assert.equal(plan.selectedInitialMode, 'read_only_support_ticket_import');
  assert.equal(plan.firstSupportedObject, 'gmail_message_as_support_ticket');
});

test('Phase 12.1 is planning only and adds no external behavior', () => {
  const safety = buildSupportConnectorSafetyPlan();
  assert.equal(safety.planningOnly, true);
  assert.equal(safety.gmailApiClientAdded, false);
  assert.equal(safety.oauthRoutesAdded, false);
  assert.equal(safety.tokenStorageAdded, false);
  assert.equal(safety.emailReadAdded, false);
  assert.equal(safety.emailSendAdded, false);
  assert.equal(safety.autoReplyAdded, false);
  assert.equal(safety.externalApiCalled, false);
});

test('scope plan requests readonly first and defers send/modify', () => {
  const plan = buildSelectedSupportConnectorPlan();
  assert.deepEqual(plan.scopePlan.initialScopes, ['https://www.googleapis.com/auth/gmail.readonly']);
  assert.equal(plan.scopePlan.futureScopesNotRequestedYet.includes('https://www.googleapis.com/auth/gmail.send'), true);
  assert.equal(plan.scopePlan.futureScopesNotRequestedYet.includes('https://www.googleapis.com/auth/gmail.modify'), true);
  assert.equal(plan.scopePlan.tokenExposureAllowedInBrowser, false);
});

test('production verification and security assessment risk are recorded', () => {
  const plan = buildSelectedSupportConnectorPlan();
  assert.equal(plan.scopePlan.restrictedScopes, true);
  assert.equal(plan.scopePlan.appVerificationRequiredBeforeProduction, true);
  assert.equal(plan.scopePlan.productionSecurityAssessmentLikelyIfRestrictedDataStored, true);
});

test('comparison includes all roadmap connector options', () => {
  const comparison = buildSupportConnectorComparison();
  const connectors = comparison.map((item) => item.connector).sort();
  assert.deepEqual(connectors, ['gmail', 'gorgias', 'help_scout', 'helpdesk', 'support_inbox', 'zendesk'].sort());
  assert.equal(comparison.find((item) => item.connector === 'gmail')?.decision, 'selected');
});

test('future support draft to action flow remains approval first', () => {
  const plan = buildSelectedSupportConnectorPlan();
  assert.equal(plan.futureDraftToActionFlow.includes('create_support_reply_send_proposed_action'), true);
  assert.equal(plan.futureDraftToActionFlow.includes('require_founder_approval'), true);
  assert.equal(plan.futureDraftToActionFlow.includes('later_executor_sends_only_when_phase_allows'), true);
});

test('status is safe and concise', () => {
  const status = buildSupportConnectorPlanStatus();
  assert.equal(status.deliverable, 'selected_support_connector_plan');
  assert.equal(status.planningOnly, true);
  assert.equal(status.emailReadAdded, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.externalApiCalled, false);
  assert.doesNotThrow(() => assertSupportConnectorPlanSafe(status));
});

test('full plan has no secret-like output', () => {
  const plan = buildSelectedSupportConnectorPlan();
  assert.doesNotThrow(() => assertSupportConnectorPlanSafe(plan));
});

test('safe assertion rejects secret-like content', () => {
  const plan = buildSelectedSupportConnectorPlan() as any;
  plan.accidental = 'refresh_token should not be exposed';
  assert.throws(() => assertSupportConnectorPlanSafe(plan), /forbidden fragment/);
});
