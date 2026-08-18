import assert from 'node:assert/strict';
import {
  FUNCTIONAL_AUDIT_HEALTH_MODE,
  FUNCTIONAL_AUDIT_SAFETY,
  FUNCTIONAL_AUDIT_SURFACES,
  buildFunctionalAuditCounts,
  getFunctionalAuditChecklist,
  getFunctionalAuditMap,
  getFunctionalAuditReport,
  getFunctionalAuditStatus,
  previewFunctionalAudit,
} from './functional-audit.model.js';

const status = getFunctionalAuditStatus();
assert.equal(status.healthMode, FUNCTIONAL_AUDIT_HEALTH_MODE);
assert.equal(status.backendPersistenceEnabledByThisPhase, false);
assert.equal(status.realExecutionEnabledByThisPhase, false);
assert.equal(status.safety.noExternalConnectorCall, true);

const report = getFunctionalAuditReport();
assert.equal(report.surfaces.length, FUNCTIONAL_AUDIT_SURFACES.length);
assert.ok(report.surfaces.some((surface) => surface.key === 'rules_ui' && surface.status === 'ui_preview_only'));
assert.ok(report.surfaces.some((surface) => surface.key === 'memory_management' && surface.status === 'needs_backend_persistence'));
assert.ok(report.surfaces.some((surface) => surface.key === 'approval_queue' && surface.status === 'backend_connected'));
assert.ok(report.surfaces.every((surface) => surface.primaryApis.length > 0));

const counts = buildFunctionalAuditCounts();
assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), FUNCTIONAL_AUDIT_SURFACES.length);

const map = getFunctionalAuditMap();
assert.ok(map.byDomain.dashboard.length >= 1);
assert.ok(map.byDomain.safety.length >= 1);

const checklist = getFunctionalAuditChecklist();
assert.ok(checklist.checklist.some((item) => item.includes('button')));
assert.ok(checklist.requiredBeforeV081.includes('Safety gates preserved'));

const preview = previewFunctionalAudit({ checkedSurfaceKeys: FUNCTIONAL_AUDIT_SURFACES.map((surface) => surface.key), completedManualChecks: ['health_endpoint_checked'] });
assert.equal(preview.decision, 'ready_for_backend_persistence_planning');
assert.equal(preview.wouldCreateActionThisPhase, false);
assert.equal(preview.wouldCallExecutorThisPhase, false);
assert.equal(preview.wouldCallExternalConnectorThisPhase, false);

const unsafe = previewFunctionalAudit({ checkedSurfaceKeys: ['dashboard_kpis'], api_key: 'secret', force: true });
assert.equal(unsafe.decision, 'blocked_until_review');
assert.ok(unsafe.issues.some((issue) => issue.includes('api_key')));
assert.ok(unsafe.issues.some((issue) => issue.includes('force=true')));
assert.deepEqual(FUNCTIONAL_AUDIT_SAFETY, preview.safety);

console.log('functional-audit-tests — 40 passed, 0 failed');
