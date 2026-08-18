// LIFE.SAVER v0.8.3 Functional Audit UI
(function () {
  var API_BASE = (window.LIFESAVER_API_BASE || '/api/v1').replace(/\/$/, '');
  var TOKEN_KEY = 'lifesaver_auth_token';
  var auditReport = null;
  var auditChecklist = null;

  function $(id) { return document.getElementById(id); }
  function getAuthToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function authHeaders() { var token = getAuthToken(); return token ? { Authorization: 'Bearer ' + token } : {}; }
  function setText(id, text) { var node = $(id); if (node) node.textContent = text; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]; }); }
  function statusClass(status, risk) {
    if (status === 'backend_connected') return 'good';
    if (risk === 'critical' || status === 'connector_disabled_by_design') return 'danger';
    return 'warn';
  }
  function readableStatus(status) { return String(status || '').replace(/_/g, ' '); }
  async function getJson(path) {
    var response = await fetch(API_BASE + path, { headers: { Accept: 'application/json', ...authHeaders() } });
    var text = await response.text();
    var data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data?.error?.message || data?.message || 'Request failed');
    return data.data || data;
  }
  function renderCounts(report) {
    var counts = report.counts || {};
    setText('surfaceCount', String((report.surfaces || []).length));
    setText('countBackend', String(counts.backend_connected || 0));
    setText('countPartial', String((counts.partial_backend_connected || 0) + (counts.framework_only || 0) + (counts.needs_backend_persistence || 0)));
    setText('countPreview', String((counts.ui_preview_only || 0) + (counts.connector_disabled_by_design || 0)));
  }
  function renderSurfaces() {
    var grid = $('surfaceGrid');
    if (!grid || !auditReport) return;
    var filter = $('statusFilter')?.value || 'all';
    var surfaces = auditReport.surfaces || [];
    if (filter !== 'all') surfaces = surfaces.filter(function (surface) { return surface.status === filter; });
    grid.innerHTML = surfaces.map(function (surface) {
      var pillClass = statusClass(surface.status, surface.activationRisk);
      return '<article class="functional-surface-card">'
        + '<h3>' + escapeHtml(surface.label) + '</h3>'
        + '<div class="functional-card-meta">'
        + '<span class="functional-pill ' + pillClass + '">' + escapeHtml(readableStatus(surface.status)) + '</span>'
        + '<span class="functional-pill">Risk: ' + escapeHtml(surface.activationRisk) + '</span>'
        + '<span class="functional-pill ' + (surface.mobileReady ? 'good' : 'warn') + '">' + (surface.mobileReady ? 'Mobile ready' : 'Needs mobile QA') + '</span>'
        + '</div>'
        + '<div class="functional-card-section"><strong>Page</strong><p>' + escapeHtml(surface.page) + '</p></div>'
        + '<div class="functional-card-section"><strong>Current state</strong><p>' + escapeHtml(surface.currentState) + '</p></div>'
        + '<div class="functional-card-section"><strong>Primary APIs</strong><ul>' + (surface.primaryApis || []).map(function (api) { return '<li>' + escapeHtml(api) + '</li>'; }).join('') + '</ul></div>'
        + '<div class="functional-card-section"><strong>Missing for full functionality</strong><ul>' + (surface.missingForFullFunctionality || []).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul></div>'
        + '<div class="functional-card-section"><strong>Recommended next step</strong><p>' + escapeHtml(surface.recommendedNextStep) + '</p></div>'
        + '</article>';
    }).join('') || '<p class="note warn">No surfaces match this filter.</p>';
    var preview = $('auditJsonPreview');
    if (preview) preview.textContent = JSON.stringify(auditReport, null, 2);
  }
  function renderChecklist(checklist) {
    var list = $('auditChecklist');
    var before = $('beforeV081');
    if (list) list.innerHTML = (checklist.checklist || []).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('');
    if (before) before.innerHTML = (checklist.requiredBeforeV081 || []).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('');
  }
  function renderNextPhases(report) {
    var grid = $('nextPhaseGrid');
    if (!grid) return;
    grid.innerHTML = (report.nextPhases || []).map(function (phase) {
      return '<article class="functional-next-card"><h3>' + escapeHtml(phase.version + ' — ' + phase.label) + '</h3><p>' + escapeHtml(phase.goal) + '</p><p><strong>Deliverable:</strong> ' + escapeHtml(phase.deliverable) + '</p><p class="note warn">' + escapeHtml(phase.safetyBoundary) + '</p></article>';
    }).join('');
  }
  async function loadAudit() {
    setText('auditLoadState', 'LOADING AUDIT');
    try {
      auditReport = await getJson('/orchestrator/functional-audit/report');
      auditChecklist = await getJson('/orchestrator/functional-audit/checklist');
      renderCounts(auditReport);
      renderSurfaces();
      renderChecklist(auditChecklist);
      renderNextPhases(auditReport);
      setText('auditLoadState', 'AUDIT LOADED');
    } catch (error) {
      setText('auditLoadState', 'AUDIT FALLBACK');
      var fallback = {
        surfaces: [],
        counts: {},
        nextPhases: [],
        error: error.message,
        note: 'Login may be required. The functional audit API is protected like other operator surfaces.'
      };
      auditReport = fallback;
      renderSurfaces();
      var preview = $('auditJsonPreview');
      if (preview) preview.textContent = JSON.stringify(fallback, null, 2);
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    $('refreshAuditBtn')?.addEventListener('click', loadAudit);
    $('statusFilter')?.addEventListener('change', renderSurfaces);
    $('copyAuditJsonBtn')?.addEventListener('click', function () {
      var text = JSON.stringify(auditReport || {}, null, 2);
      navigator.clipboard?.writeText(text);
      setText('auditLoadState', 'JSON COPIED');
    });
    loadAudit();
  });
})();
