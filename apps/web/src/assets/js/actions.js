// LIFE.SAVER v0.8.3 Mobile Operator UI Release QA
// Frontend/mobile review-surface hardening only. Existing backend approval/executor logic is unchanged.
const API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';
const TOKEN_KEY = 'lifesaver_auth_token';
const USER_KEY = 'lifesaver_auth_user';
const WORKSPACE_KEY = 'lifesaver_auth_workspace';
const $ = (id) => document.getElementById(id);
const detailCache = new Map();
let lastFocusedElement = null;
const approvalConfirmState = { detail: null, busy: false, lastFocusedElement: null };
const rejectConfirmState = { detail: null, busy: false, lastFocusedElement: null };
const cancelConfirmState = { detail: null, busy: false, lastFocusedElement: null };
const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PRIMARY_STATUS_FILTERS = [
  { value: '', label: 'All', help: 'Showing all workspace-scoped actions.' },
  { value: 'proposed', label: 'Proposed', help: 'Showing proposed actions waiting for review.' },
  { value: 'approved', label: 'Approved', help: 'Showing internally approved actions. Execution remains governed by existing safety gates.' },
  { value: 'rejected', label: 'Rejected', help: 'Showing rejected actions. No external action was performed.' },
  { value: 'executed', label: 'Executed', help: 'Showing executed/sandbox-result actions where stored; mobile only changes display.' },
  { value: 'failed', label: 'Failed', help: 'Showing failed actions for future executor/action result review.' },
  { value: 'cancelled', label: 'Cancelled', help: 'Showing actions cancelled before execution.' },
  { value: 'rolled_back', label: 'Rolled Back', help: 'Showing future rolled-back actions after rollback flow exists.' },
];

const DEFAULT_ACTION_POLL_INTERVAL_MS = 60000;
const MIN_ACTION_POLL_INTERVAL_MS = 30000;
const MAX_ACTION_POLL_INTERVAL_MS = 60000;
let actionPollingEnabled = true;
let actionPollingTimer = null;
let isLoadingActions = false;
let lastActionListFingerprint = '';
let lastDeepLinkOpenedId = '';

function getAuthToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
function authHeaders(){ const token = getAuthToken(); return token ? { Authorization: `Bearer ${token}` } : {}; }
function isSafeActionId(value){
  const clean = String(value || '').trim();
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(clean);
}
const MUTATING_DEEP_LINK_PARAMS = [
  'approve','approved','reject','rejected','execute','executed','publish','send','run','rollback','delete','confirm','autoapprove','auto_approve','decision','status','action_status','mutation','method'
];
function hasUnsafeActionDeepLinkMutationParams(){
  const params = new URLSearchParams(window.location.search || '');
  return MUTATING_DEEP_LINK_PARAMS.some((key) => params.has(key));
}
function getDeepLinkedActionId(){
  if(hasUnsafeActionDeepLinkMutationParams()) return '';
  const params = new URLSearchParams(window.location.search || '');
  const queryId = params.get('actionId') || params.get('action_id') || '';
  const hashId = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
  const candidate = (queryId || hashId || '').trim();
  return isSafeActionId(candidate) ? candidate.toLowerCase() : '';
}
function currentReturnPath(){
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
function redirectToLoginForDeepLink(){
  const returnTo = currentReturnPath();
  window.location.href = `./login.html?returnTo=${encodeURIComponent(returnTo)}`;
}

function shouldLogNotificationOpened(){
  const params = new URLSearchParams(window.location.search || '');
  const source = String(params.get('source') || '').toLowerCase();
  return ['email_notification','in_app_notification','in_app_notification_center','notification_center','notification_trigger','approval_reminder'].includes(source);
}
async function logNotificationOpenedFromDeepLink(actionId){
  if(!actionId || !shouldLogNotificationOpened()) return;
  try{
    const params = new URLSearchParams(window.location.search || '');
    await fetch(`${API_BASE}/api/v1/notifications/delivery-logs/opened`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        actionId,
        notificationKey: params.get('notificationKey') || params.get('notification_key') || null,
        channel: params.get('channel') || (params.get('source') === 'email_notification' ? 'email' : 'in_app')
      })
    });
  }catch(error){
    console.warn('Notification opened log could not be recorded', error);
  }
}

function clearActionDeepLinkFromUrl(){
  const url = new URL(window.location.href);
  url.searchParams.delete('actionId');
  url.searchParams.delete('action_id');
  url.searchParams.delete('source');
  url.searchParams.delete('linkMode');
  url.searchParams.delete('notificationKey');
  url.searchParams.delete('notification_key');
  MUTATING_DEEP_LINK_PARAMS.forEach((key) => url.searchParams.delete(key));
  url.hash = '';
  const clean = `${url.pathname}${url.search ? url.search : ''}`;
  window.history.replaceState(null, '', clean);
}
function readJsonStorage(key){ try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function escapeHtml(value){
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function label(value){ return window.LifeSaverActionCard?.label ? window.LifeSaverActionCard.label(value) : String(value || 'unknown').replace(/_/g, ' '); }
function formatDate(value){ return window.LifeSaverActionCard?.formatDate ? window.LifeSaverActionCard.formatDate(value) : (value || '—'); }
function safeJson(value){
  try { return JSON.stringify(value || {}, null, 2); } catch { return '{}'; }
}
function firstText(){
  for(let i = 0; i < arguments.length; i += 1){
    const value = arguments[i];
    if(typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
function setMessage(text, kind = ''){
  const el = $('actionsMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : (kind === 'warn' ? 'note warn' : 'note'));
}

function setActionsBusy(isBusy){
  const list = $('actionsList');
  if(list) list.setAttribute('aria-busy', isBusy ? 'true' : 'false');
}
function getOpenDialog(){
  if(!$('rejectConfirmOverlay')?.hidden) return $('rejectConfirmModal');
  if(!$('cancelConfirmOverlay')?.hidden) return $('cancelConfirmModal');
  if(!$('approvalConfirmOverlay')?.hidden) return $('approvalConfirmModal');
  if(!$('actionDetailOverlay')?.hidden) return $('actionDetailDrawer');
  return null;
}
function trapDialogFocus(event){
  if(event.key !== 'Tab') return;
  const dialog = getOpenDialog();
  if(!dialog) return;
  const focusable = Array.from(dialog.querySelectorAll(focusableSelector)).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
  if(!focusable.length){
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if(event.shiftKey && document.activeElement === first){
    event.preventDefault();
    last.focus();
  }else if(!event.shiftKey && document.activeElement === last){
    event.preventDefault();
    first.focus();
  }
}
function focusFirstDialogControl(dialog){
  if(!dialog) return;
  const first = Array.from(dialog.querySelectorAll(focusableSelector)).find((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
  window.setTimeout(() => (first || dialog).focus(), 0);
}

function formatClockTime(date = new Date()){
  try{
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }catch{
    return 'just now';
  }
}
function clampPollInterval(value){
  const number = Number(value || DEFAULT_ACTION_POLL_INTERVAL_MS);
  if(Number.isNaN(number)) return DEFAULT_ACTION_POLL_INTERVAL_MS;
  return Math.min(MAX_ACTION_POLL_INTERVAL_MS, Math.max(MIN_ACTION_POLL_INTERVAL_MS, number));
}
function getPollIntervalMs(){
  return clampPollInterval($('pollingIntervalSelect')?.value || DEFAULT_ACTION_POLL_INTERVAL_MS);
}
function getPollIntervalLabel(){
  return `${Math.round(getPollIntervalMs() / 1000)} seconds`;
}
function isAnyReviewOverlayOpen(){
  return !$('actionDetailOverlay')?.hidden || !$('approvalConfirmOverlay')?.hidden || !$('rejectConfirmOverlay')?.hidden || !$('cancelConfirmOverlay')?.hidden;
}
function setRefreshState(text, kind = ''){
  const badge = $('refreshState');
  if(badge){
    badge.textContent = text;
    badge.className = kind === 'paused' || kind === 'warn' ? 'badge warn-badge' : (kind === 'error' ? 'badge danger-badge' : 'badge');
  }
}
function updateLastRefreshTime(date = new Date()){
  const el = $('lastRefreshTime');
  if(el) el.textContent = formatClockTime(date);
}
function updatePollingUi(){
  const state = $('autoRefreshState');
  const help = $('nextRefreshText');
  const toggle = $('toggleAutoRefreshBtn');
  const intervalLabel = getPollIntervalLabel();
  if(state) state.textContent = actionPollingEnabled ? 'Polling ON' : 'Polling PAUSED';
  if(help){
    help.textContent = actionPollingEnabled
      ? `Checking for new actions every ${intervalLabel}. Pauses while modals are open or the tab is hidden.`
      : 'Automatic polling is paused. Manual Refresh Actions still works.';
  }
  if(toggle){
    toggle.textContent = actionPollingEnabled ? 'Pause Auto Refresh' : 'Resume Auto Refresh';
    toggle.setAttribute('aria-pressed', actionPollingEnabled ? 'true' : 'false');
  }
  setRefreshState(actionPollingEnabled ? 'POLLING ON' : 'POLLING PAUSED', actionPollingEnabled ? '' : 'paused');
}
function stopActionPolling(){
  if(actionPollingTimer){
    clearTimeout(actionPollingTimer);
    actionPollingTimer = null;
  }
}
function scheduleActionPolling(){
  stopActionPolling();
  updatePollingUi();
  if(!actionPollingEnabled) return;
  actionPollingTimer = window.setTimeout(async function(){
    if(!actionPollingEnabled) return;
    if(document.hidden){
      setRefreshState('POLLING PAUSED', 'paused');
      scheduleActionPolling();
      return;
    }
    if(isAnyReviewOverlayOpen()){
      setRefreshState('REVIEW PAUSED', 'paused');
      scheduleActionPolling();
      return;
    }
    await loadActions({ silent: true, reason: 'poll' });
    scheduleActionPolling();
  }, getPollIntervalMs());
}
function computeActionListFingerprint(items){
  return (Array.isArray(items) ? items : []).map((item) => [item.id, item.status, item.updatedAt || item.createdAt, item.riskLevel].join(':')).join('|');
}
function getPrimaryStatusMeta(value){
  return PRIMARY_STATUS_FILTERS.find((item) => item.value === value) || PRIMARY_STATUS_FILTERS[0];
}
function updateStatusFilterUi(){
  const value = $('statusFilter')?.value || '';
  const meta = getPrimaryStatusMeta(value);
  const activeLabel = $('activeStatusLabel');
  const help = $('statusFilterHelp');
  if(activeLabel) activeLabel.textContent = meta.label;
  if(help) help.textContent = `${meta.help} Filters are read-only. Approval and rejection require confirmation and cannot execute anything.`;
  document.querySelectorAll('[data-status-filter]').forEach((button) => {
    const isActive = (button.getAttribute('data-status-filter') || '') === value;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}
function setStatusFilter(value){
  const select = $('statusFilter');
  if(select) select.value = value || '';
  updateStatusFilterUi();
  loadActions({ reason: 'status-filter' });
}
function updateAuthUi(){
  const token = getAuthToken();
  const user = readJsonStorage(USER_KEY);
  const workspace = readJsonStorage(WORKSPACE_KEY);
  if(!token){
    $('authState').textContent = 'LOGIN REQUIRED';
    $('authState').className = 'badge warn-badge';
    $('loggedInUser').textContent = 'Not logged in';
    $('loggedInWorkspace').textContent = 'Open Login to access protected actions.';
    const deepLinkedActionId = getDeepLinkedActionId();
    if(deepLinkedActionId){
      setMessage('Login is required before LIFE.SAVER can open this secure approval deep link. Redirecting to login…', 'warn');
      window.setTimeout(redirectToLoginForDeepLink, 450);
    }else{
      setMessage('Login is required before LIFE.SAVER can show workspace-scoped actions.', 'warn');
    }
    return false;
  }
  $('authState').textContent = 'AUTHENTICATED';
  $('authState').className = 'badge';
  $('loggedInUser').textContent = user?.email || 'Authenticated';
  $('loggedInWorkspace').textContent = workspace?.name || workspace?.id || 'Workspace loaded';
  return true;
}
function handleAuthFailure(response){
  if(response.status === 401){
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
    updateAuthUi();
    return true;
  }
  return false;
}
function buildQuery(){
  const params = new URLSearchParams();
  const status = $('statusFilter')?.value || '';
  const actionType = $('typeFilter')?.value || '';
  const risk = $('riskFilter')?.value || '';
  if(status) params.set('status', status);
  if(actionType) params.set('action_type', actionType);
  if(risk) params.set('risk_level', risk);
  params.set('limit', '12');
  params.set('offset', '0');
  return params.toString();
}
async function fetchActionDetail(id){
  if(detailCache.has(id)) return detailCache.get(id);
  try{
    const res = await fetch(`${API_BASE}/api/v1/actions/${encodeURIComponent(id)}`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return null;
    if(!res.ok) return null;
    const json = await res.json();
    const detail = json.success ? json.data : null;
    if(detail) detailCache.set(id, detail);
    return detail;
  }catch(error){
    console.warn('Unable to load action detail preview', id, error);
    return null;
  }
}
function getPreview(detail){ return detail?.payloadPreview?.preview || {}; }
function getAction(detail){ return detail?.action || {}; }
function normalizeRisk(value){
  return window.LifeSaverActionCard?.normalizeRisk ? window.LifeSaverActionCard.normalizeRisk(value) : (['low','medium','high','critical'].includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'medium');
}
function riskBadgeLabel(value){
  return window.LifeSaverActionCard?.riskBadgeLabel ? window.LifeSaverActionCard.riskBadgeLabel(value) : `${label(normalizeRisk(value))} Risk`;
}
function riskBadgeMessage(value){
  return window.LifeSaverActionCard?.riskBadgeMessage ? window.LifeSaverActionCard.riskBadgeMessage(value) : 'Review this action carefully before approval.';
}
function getCriticalWarningTriggers(detail){
  const action = getAction(detail);
  if(window.LifeSaverActionCard?.criticalWarningTriggers) return window.LifeSaverActionCard.criticalWarningTriggers(action, detail) || [];
  return [];
}
function getRiskWarning(detail){
  const action = getAction(detail);
  const risk = normalizeRisk(action.riskLevel || detail?.risk?.level);
  const triggers = getCriticalWarningTriggers(detail);
  const critical = risk === 'critical' || triggers.length > 0;
  const warningLevel = critical ? 'critical' : risk;
  const title = critical ? 'Critical Warning' : (risk === 'high' ? 'High-Risk Review' : riskBadgeLabel(risk));
  const triggerText = triggers.length ? ` Critical trigger: ${triggers.join(' · ')}.` : '';
  return {
    risk,
    warningLevel,
    critical,
    title,
    message: `${riskBadgeMessage(warningLevel)}${triggerText}`,
    triggers
  };
}
function renderRiskWarningPanel(detail){
  const risk = getRiskWarning(detail);
  return '<div class="risk-warning-panel risk-warning-' + escapeHtml(risk.warningLevel) + '"><div><strong>' + escapeHtml(risk.title) + '</strong><p>' + escapeHtml(risk.message) + '</p></div><span>' + escapeHtml(riskBadgeLabel(risk.risk)) + '</span></div>';
}
function setRiskWarningBox(id, detail){
  const el = $(id);
  if(!el) return;
  const risk = getRiskWarning(detail);
  el.className = 'risk-warning-box risk-warning-' + risk.warningLevel;
  el.innerHTML = '<strong>' + escapeHtml(risk.title) + '</strong><span>' + escapeHtml(risk.message) + '</span>';
}
function buildProposedContent(detail){
  const preview = getPreview(detail);
  const content = firstText(
    preview.captionPreview,
    preview.replyBodyPreview,
    preview.messagePreview,
    preview.taskSummaryPreview,
    preview.questionPreview,
    preview.objectivePreview,
    preview.rollbackReasonPreview,
    detail?.payloadPreview?.intentSummary,
    detail?.action?.description
  );
  return content || 'No proposed content preview is available for this action yet. The raw payload remains safely server-side.';
}
function buildExpectedResult(detail){
  const action = getAction(detail);
  const preview = getPreview(detail);
  switch(action.actionType){
    case 'content_publish':
      return `Would publish/schedule content to ${preview.platform || 'the selected content platform'} after future approval and executor phases. Execution is currently disabled.`;
    case 'support_reply_send':
      return `Would send a support reply to the correct thread ${preview.threadId ? `(${preview.threadId})` : ''} after future approval and support executor phases. Execution is currently disabled.`;
    case 'ad_budget_adjust':
      return `Would propose changing budget from ${preview.currentBudget ?? 'current budget'} to ${preview.proposedBudget ?? 'proposed budget'} on ${preview.platform || 'the selected ad platform'} after future approval and ads executor phases. Execution is currently disabled.`;
    case 'ad_pause':
      return `Would pause or change status for the selected ${preview.targetLevel || 'ad object'} after future approval and ads executor phases. Execution is currently disabled.`;
    case 'research_task':
      return 'Would create an internal research task/output only. No external platform write is involved.';
    case 'dev_task':
      return 'Would create an internal development task only. No repository change or deployment is performed by this UI.';
    case 'notification_send':
      return 'Would send an in-app/email notification only after future notification executor phases. Delivery is currently disabled.';
    case 'rollback_action':
      return 'Would request a rollback flow only after future rollback executor support exists. Rollback execution is currently disabled.';
    default:
      return 'Expected result is pending for this action type. No executor is enabled.';
  }
}
function buildRelatedContext(detail){
  const action = getAction(detail);
  const p = getPreview(detail);
  const pairs = [];
  function add(key, value){ if(value !== undefined && value !== null && value !== '') pairs.push([key, value]); }
  add('Platform', p.platform || p.supportProvider || p.channel || p.targetLevel);
  add('Campaign ID', p.campaignId);
  add('Ad Set ID', p.adsetId);
  add('Ad ID', p.adId);
  add('Target ID', p.targetId);
  add('Ticket ID', p.ticketId);
  add('Thread ID', p.threadId);
  add('Customer Hint', p.customerEmailHint || p.recipientHint);
  add('Metric Window', p.metricWindow);
  add('Current Budget', p.currentBudget);
  add('Proposed Budget', p.proposedBudget);
  add('Change Amount', p.changeAmount);
  add('Scheduled Time', p.scheduledTime || p.dueAt);
  add('Media URL', p.mediaUrl);
  add('Workspace ID', detail.workspaceId);
  add('Action ID', action.id);
  return pairs;
}
function renderKeyValueGrid(pairs){
  if(!pairs.length) return '<p class="muted">No related metric, ticket, campaign, or platform context has been attached yet.</p>';
  return '<div class="action-detail-grid">' + pairs.map(([key, value]) => '<div class="action-detail-kv"><span>' + escapeHtml(key) + '</span><strong>' + escapeHtml(String(value)) + '</strong></div>').join('') + '</div>';
}
function renderPayloadPreview(detail){
  const preview = detail?.payloadPreview || {};
  const pairs = [
    ['Schema Version', preview.schemaVersion || '—'],
    ['Action Type', label(preview.actionType || detail?.action?.actionType)],
    ['Source', preview.source || '—'],
    ['Intent', preview.intentSummary || '—'],
    ['Data Keys', Array.isArray(preview.dataKeys) ? preview.dataKeys.join(', ') || '—' : '—'],
    ['Redacted Fields', Array.isArray(preview.redactedFields) ? preview.redactedFields.join(', ') || 'None' : 'None'],
  ];
  return renderKeyValueGrid(pairs) + '<div class="action-preview-json" aria-label="Payload preview JSON">' + escapeHtml(safeJson(preview.preview || {})) + '</div><p class="muted">' + escapeHtml(preview.note || 'Safe payload preview only. Full raw payload_json is not shown in the browser.') + '</p>';
}
function renderTimeline(detail){
  const items = Array.isArray(detail?.statusHistory) ? detail.statusHistory : [];
  if(!items.length) return '<p class="muted">No timeline events have been recorded yet.</p>';
  return '<div class="action-timeline">' + items.map((item) => {
    const flow = item.fromStatus || item.toStatus ? `${item.fromStatus || '—'} → ${item.toStatus || '—'}` : 'No status transition';
    return '<div class="action-timeline-item"><div class="action-timeline-title"><strong>' + escapeHtml(label(item.eventType)) + '</strong><time>' + escapeHtml(formatDate(item.createdAt)) + '</time></div><div class="action-timeline-flow">' + escapeHtml(flow) + '</div><p>' + escapeHtml(item.message || 'Event recorded safely.') + '</p></div>';
  }).join('') + '</div>';
}
function renderResults(detail){
  const results = Array.isArray(detail?.resultSummary) ? detail.resultSummary : [];
  if(!results.length) return '<p class="muted">No executor result log is stored yet. After sandbox lifecycle persistence runs, safe action result summaries appear here.</p>';
  return results.map((result) => {
    const externalBits = [];
    if(result.externalId) externalBits.push('Fake external ID: ' + escapeHtml(result.externalId));
    if(result.externalUrl) externalBits.push('<a href="' + escapeHtml(result.externalUrl) + '" target="_blank" rel="noopener">Sandbox permalink</a>');
    const metadata = result.metadataPreview && typeof result.metadataPreview === 'object' ? result.metadataPreview : {};
    const metadataText = Object.keys(metadata).length ? '<details class="action-result-metadata"><summary>Safe metadata preview</summary><pre>' + escapeHtml(safeJson(metadata)) + '</pre></details>' : '';
    return '<div class="action-result-item"><strong>' + escapeHtml(result.executorName || 'Executor') + ' · ' + escapeHtml(label(result.resultStatus)) + '</strong><small>' + escapeHtml(formatDate(result.createdAt)) + '</small><p>' + escapeHtml(result.resultSummary || result.errorMessage || 'Result recorded in action_results.') + '</p><small>' + (externalBits.length ? externalBits.join(' · ') + ' · ' : '') + 'Rollback supported: ' + escapeHtml(result.rollbackSupported ? 'yes' : 'no') + ' · rollback payload hidden from browser</small>' + metadataText + '</div>';
  }).join('');
}
function openActionDetail(detail){
  if(!detail || !detail.action){
    setMessage('Unable to open detail. The action detail endpoint did not return safe review data.', 'error');
    return;
  }
  const action = detail.action;
  const overlay = $('actionDetailOverlay');
  const drawer = $('actionDetailDrawer');
  const title = $('actionDetailTitle');
  const subtitle = $('actionDetailSubtitle');
  const badges = $('actionDetailBadges');
  const body = $('actionDetailBody');
  const footerApprove = drawer.querySelector('[data-action-control="approve"]');
  const footerReject = drawer.querySelector('[data-action-control="reject"]');

  title.textContent = action.title || 'Untitled action';
  subtitle.textContent = `${label(action.actionType)} · Created ${formatDate(action.createdAt)}`;
  badges.innerHTML = '' +
    '<span class="action-pill status-' + escapeHtml(action.status) + '">' + escapeHtml(label(action.status)) + '</span>' +
    '<span class="action-risk-badge risk-' + escapeHtml(normalizeRisk(action.riskLevel)) + '" title="' + escapeHtml(riskBadgeMessage(action.riskLevel)) + '"><span class="risk-dot"></span>' + escapeHtml(riskBadgeLabel(action.riskLevel)) + '</span>' +
    '<span class="action-pill">Policy: ' + escapeHtml(label(detail.policy?.decision || action.policyDecision || 'ask')) + '</span>' +
    '<span class="action-pill">Role: ' + escapeHtml(label(detail.userRole || 'unknown')) + '</span>';
  if(footerApprove) footerApprove.setAttribute('data-action-id', action.id);
  if(footerReject) footerReject.setAttribute('data-action-id', action.id);

  body.innerHTML = '' +
    '<section class="action-detail-section"><h3>Full Proposed Content</h3><div class="action-proposed-content">' + escapeHtml(buildProposedContent(detail)) + '</div><p class="muted">This drawer displays proposed content from the safe detail API. Raw payload_json and secrets remain server-side.</p></section>' +
    '<section class="action-detail-section"><h3>Expected Result</h3><p>' + escapeHtml(buildExpectedResult(detail)) + '</p></section>' +
    '<section class="action-detail-section"><h3>Policy Decision</h3><div class="action-detail-grid"><div class="action-detail-kv"><span>Decision</span><strong>' + escapeHtml(label(detail.policy?.decision || action.policyDecision)) + '</strong></div><div class="action-detail-kv"><span>Approval</span><strong>' + escapeHtml(action.approvalRequired ? 'Required' : 'Not required') + '</strong></div></div><p>' + escapeHtml(detail.policy?.note || 'Policy decision is review-only in this phase.') + '</p></section>' +
    '<section class="action-detail-section"><h3>Risk Explanation</h3>' + renderRiskWarningPanel(detail) + '<div class="action-detail-grid"><div class="action-detail-kv"><span>Risk Level</span><strong>' + escapeHtml(riskBadgeLabel(detail.risk?.level || action.riskLevel)) + '</strong></div><div class="action-detail-kv"><span>Critical Triggers</span><strong>' + escapeHtml(getCriticalWarningTriggers(detail).join(' · ') || 'None detected') + '</strong></div><div class="action-detail-kv"><span>Current Role Can Approve Later</span><strong>' + escapeHtml(detail.risk?.canCurrentRoleApproveInFuture ? 'Yes' : 'No') + '</strong></div><div class="action-detail-kv"><span>Review Rule</span><strong>' + escapeHtml(normalizeRisk(action.riskLevel) === 'critical' || getCriticalWarningTriggers(detail).length ? 'Founder-level review recommended' : 'Standard approval review') + '</strong></div></div><p>' + escapeHtml(detail.risk?.note || 'Risk note not available.') + '</p></section>' +
    '<section class="action-detail-section"><h3>Related Metric / Ticket / Campaign</h3>' + renderKeyValueGrid(buildRelatedContext(detail)) + '</section>' +
    '<section class="action-detail-section"><h3>Payload Preview</h3>' + renderPayloadPreview(detail) + '</section>' +
    '<section class="action-detail-section"><h3>Timeline</h3>' + renderTimeline(detail) + '</section>' +
    '<section class="action-detail-section"><h3>Result Summary</h3>' + renderResults(detail) + '</section>' +
    '<section class="action-detail-section"><h3>Safety Boundary</h3><p>' + escapeHtml(detail.safety?.note || 'This drawer cannot execute, publish, send, spend, pause, refund, or write externally.') + '</p></section>';

  lastFocusedElement = document.activeElement;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  focusFirstDialogControl(drawer);
  const params = new URLSearchParams(window.location.search || '');
  if(!(params.get('actionId') || params.get('action_id'))){
    window.history.replaceState(null, '', `#${encodeURIComponent(action.id)}`);
  }
}
async function openActionDetailById(id){
  if(!id) return;
  setMessage('Opening safe action detail drawer…');
  const detail = await fetchActionDetail(id);
  openActionDetail(detail);
}
function closeActionDetail(){
  const overlay = $('actionDetailOverlay');
  if(!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.style.overflow = '';
  if(window.location.hash || new URLSearchParams(window.location.search || '').get('actionId') || new URLSearchParams(window.location.search || '').get('action_id')) clearActionDeepLinkFromUrl();
  lastDeepLinkOpenedId = '';
  if(lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
}

function canOpenApproveConfirmation(action){
  const status = action?.status;
  return ['proposed', 'approval_required', 'auto_approved'].includes(status);
}
function buildApproveWhatHappens(detail){
  const action = getAction(detail);
  const type = label(action.actionType);
  return `LIFE.SAVER will mark this ${type} action as Approved internally and log an approval event. It will not queue or execute the action in this UI phase.`;
}
function setApprovalConfirmMessage(text, kind = ''){
  const el = $('approvalConfirmMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger compact-note' : (kind === 'success' ? 'note green-note compact-note' : (kind === 'warn' ? 'note warn compact-note' : 'note compact-note'));
}
function setFinalApproveBusy(isBusy){
  approvalConfirmState.busy = isBusy;
  const button = $('finalApproveActionBtn');
  if(button){
    button.disabled = isBusy;
    button.textContent = isBusy ? 'Approving…' : 'Final Approve';
  }
}
function getPlatformForApproval(detail){
  const action = getAction(detail);
  if(window.LifeSaverActionCard?.inferPlatform){
    return window.LifeSaverActionCard.inferPlatform(action, detail);
  }
  const preview = getPreview(detail);
  return preview.platform || preview.supportProvider || preview.channel || preview.targetLevel || 'To be confirmed';
}
function openApprovalConfirmation(detail){
  if(!detail || !detail.action){
    setMessage('Unable to open approval confirmation. The action detail endpoint did not return safe review data.', 'error');
    return;
  }

  const action = detail.action;
  const overlay = $('approvalConfirmOverlay');
  const modal = $('approvalConfirmModal');
  const finalButton = $('finalApproveActionBtn');
  if(!overlay || !modal || !finalButton) return;

  approvalConfirmState.detail = detail;
  approvalConfirmState.lastFocusedElement = document.activeElement;
  $('approvalConfirmTitle').textContent = `Approve: ${action.title || 'Untitled action'}`;
  $('approvalConfirmSubtitle').textContent = `${label(action.actionType)} · ${label(action.status)} · Created ${formatDate(action.createdAt)}`;
  $('approveWhatHappens').textContent = buildApproveWhatHappens(detail);
  $('approveExecutesImmediately').textContent = 'No — execution remains disabled until future executor phases.';
  $('approvePlatformAffected').textContent = getPlatformForApproval(detail);
  $('approveRiskLevel').textContent = riskBadgeLabel(action.riskLevel);
  setRiskWarningBox('approveRiskWarning', detail);
  $('approvalNoteInput').value = '';

  const eligible = canOpenApproveConfirmation(action);
  finalButton.disabled = !eligible;
  finalButton.setAttribute('aria-disabled', eligible ? 'false' : 'true');
  if(eligible){
    setApprovalConfirmMessage('Final approval will call the safe backend approve endpoint and record an internal approval event only.', 'warn');
  }else if(action.status === 'approved'){
    setApprovalConfirmMessage('This action is already approved. No duplicate approval is needed.', 'warn');
  }else{
    setApprovalConfirmMessage(`This action cannot be approved from status: ${label(action.status)}.`, 'error');
  }

  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  focusFirstDialogControl(modal);
}
async function openApprovalConfirmationById(id){
  if(!id) return;
  setMessage('Opening approve confirmation modal…');
  const detail = await fetchActionDetail(id);
  openApprovalConfirmation(detail);
}
function closeApprovalConfirmation(){
  const overlay = $('approvalConfirmOverlay');
  if(!overlay || overlay.hidden) return;
  overlay.hidden = true;
  if($('actionDetailOverlay')?.hidden && $('rejectConfirmOverlay')?.hidden && $('cancelConfirmOverlay')?.hidden) document.body.style.overflow = '';
  approvalConfirmState.detail = null;
  approvalConfirmState.busy = false;
  const button = $('finalApproveActionBtn');
  if(button){
    button.disabled = false;
    button.textContent = 'Final Approve';
  }
  if(approvalConfirmState.lastFocusedElement && typeof approvalConfirmState.lastFocusedElement.focus === 'function') approvalConfirmState.lastFocusedElement.focus();
}
async function submitApproveConfirmation(){
  if(approvalConfirmState.busy) return;
  const detail = approvalConfirmState.detail;
  const action = detail?.action;
  if(!action?.id){
    setApprovalConfirmMessage('Missing action id. Approval cannot continue.', 'error');
    return;
  }
  if(!canOpenApproveConfirmation(action)){
    setApprovalConfirmMessage(`This action cannot be approved from status: ${label(action.status)}.`, 'error');
    return;
  }

  setFinalApproveBusy(true);
  setApprovalConfirmMessage('Recording internal approval. No external executor will run.', 'warn');
  try{
    const note = $('approvalNoteInput')?.value?.trim() || 'Approved from Phase 4.10 UI QA approval confirmation modal. No execution requested.';
    const res = await fetch(`${API_BASE}/api/v1/actions/${encodeURIComponent(action.id)}/approve`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_note: note })
    });
    if(handleAuthFailure(res)) return;
    const json = await res.json().catch(() => ({}));
    if(!res.ok || !json.success){
      const err = json.error || {};
      const requestId = err.requestId || json.requestId;
      throw new Error(`${err.code ? `${err.code}: ` : ''}${err.message || 'Approval request failed.'}${requestId ? ` Request ID: ${requestId}` : ''}`);
    }

    const data = json.data || {};
    const executed = Boolean(data.execution?.executed);
    const queued = Boolean(data.execution?.queued);
    closeApprovalConfirmation();
    detailCache.clear();
    await loadActions();
    if(!$('actionDetailOverlay')?.hidden){
      const refreshed = await fetchActionDetail(action.id);
      if(refreshed) openActionDetail(refreshed);
    }
    setMessage(`Action approved internally. Executed: ${executed ? 'yes' : 'no'} · Queued: ${queued ? 'yes' : 'no'} · External writes remain off.`, 'success');
  }catch(error){
    console.error('Approval confirmation failed', error);
    setApprovalConfirmMessage(error.message || 'Approval failed safely.', 'error');
  }finally{
    setFinalApproveBusy(false);
  }
}


function canOpenRejectConfirmation(action){
  const status = action?.status;
  return ['proposed', 'approval_required'].includes(status);
}
function getRejectionReasonLabel(value){
  const map = {
    not_on_brand: 'Not on brand',
    too_risky: 'Too risky',
    wrong_timing: 'Wrong timing',
    incorrect_data: 'Incorrect data',
    needs_edits: 'Needs edits',
    other: 'Other'
  };
  return map[value] || 'Other';
}
function buildRejectWhatHappens(detail){
  const action = getAction(detail);
  const type = label(action.actionType);
  return `LIFE.SAVER will mark this ${type} action as Rejected internally and log a rejection event with the founder reason. It will not queue or execute the action.`;
}
function setRejectConfirmMessage(text, kind = ''){
  const el = $('rejectConfirmMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger compact-note' : (kind === 'success' ? 'note green-note compact-note' : (kind === 'warn' ? 'note warn compact-note' : 'note compact-note'));
}
function setFinalRejectBusy(isBusy){
  rejectConfirmState.busy = isBusy;
  const button = $('finalRejectActionBtn');
  if(button){
    button.disabled = isBusy;
    button.textContent = isBusy ? 'Rejecting…' : 'Final Reject';
  }
}
function buildRejectionReasonText(){
  const code = $('rejectionReasonSelect')?.value || 'other';
  const labelText = getRejectionReasonLabel(code);
  const note = $('rejectionReasonDetails')?.value?.trim() || '';
  return note ? `${labelText}. ${note}` : labelText;
}
function openRejectConfirmation(detail){
  if(!detail || !detail.action){
    setMessage('Unable to open reject modal. The action detail endpoint did not return safe review data.', 'error');
    return;
  }

  const action = detail.action;
  const overlay = $('rejectConfirmOverlay');
  const modal = $('rejectConfirmModal');
  const finalButton = $('finalRejectActionBtn');
  if(!overlay || !modal || !finalButton) return;

  rejectConfirmState.detail = detail;
  rejectConfirmState.lastFocusedElement = document.activeElement;
  $('rejectConfirmTitle').textContent = `Reject: ${action.title || 'Untitled action'}`;
  $('rejectConfirmSubtitle').textContent = `${label(action.actionType)} · ${label(action.status)} · Created ${formatDate(action.createdAt)}`;
  $('rejectWhatHappens').textContent = buildRejectWhatHappens(detail);
  $('rejectCurrentStatus').textContent = label(action.status);
  $('rejectPlatformAffected').textContent = getPlatformForApproval(detail);
  $('rejectRiskLevel').textContent = riskBadgeLabel(action.riskLevel);
  setRiskWarningBox('rejectRiskWarning', detail);
  $('rejectionReasonSelect').value = 'not_on_brand';
  $('rejectionReasonDetails').value = '';

  const eligible = canOpenRejectConfirmation(action);
  finalButton.disabled = !eligible;
  finalButton.setAttribute('aria-disabled', eligible ? 'false' : 'true');
  if(eligible){
    setRejectConfirmMessage('Final reject will call the safe backend reject endpoint and record an internal rejection event only.', 'warn');
  }else if(action.status === 'rejected'){
    setRejectConfirmMessage('This action is already rejected. No duplicate rejection is needed.', 'warn');
  }else{
    setRejectConfirmMessage(`This action cannot be rejected from status: ${label(action.status)}. Use cancel or rollback flows in later phases where appropriate.`, 'error');
  }

  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  focusFirstDialogControl(modal);
}
async function openRejectConfirmationById(id){
  if(!id) return;
  setMessage('Opening reject-with-reason modal…');
  const detail = await fetchActionDetail(id);
  openRejectConfirmation(detail);
}
function closeRejectConfirmation(){
  const overlay = $('rejectConfirmOverlay');
  if(!overlay || overlay.hidden) return;
  overlay.hidden = true;
  if($('actionDetailOverlay')?.hidden && $('approvalConfirmOverlay')?.hidden && $('cancelConfirmOverlay')?.hidden) document.body.style.overflow = '';
  rejectConfirmState.detail = null;
  rejectConfirmState.busy = false;
  const button = $('finalRejectActionBtn');
  if(button){
    button.disabled = false;
    button.textContent = 'Final Reject';
  }
  if(rejectConfirmState.lastFocusedElement && typeof rejectConfirmState.lastFocusedElement.focus === 'function') rejectConfirmState.lastFocusedElement.focus();
}
async function submitRejectConfirmation(){
  if(rejectConfirmState.busy) return;
  const detail = rejectConfirmState.detail;
  const action = detail?.action;
  if(!action?.id){
    setRejectConfirmMessage('Missing action id. Rejection cannot continue.', 'error');
    return;
  }
  if(!canOpenRejectConfirmation(action)){
    setRejectConfirmMessage(`This action cannot be rejected from status: ${label(action.status)}.`, 'error');
    return;
  }

  setFinalRejectBusy(true);
  setRejectConfirmMessage('Recording internal rejection. No external executor will run.', 'warn');
  try{
    const reasonText = buildRejectionReasonText();
    const res = await fetch(`${API_BASE}/api/v1/actions/${encodeURIComponent(action.id)}/reject`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_reason: reasonText })
    });
    if(handleAuthFailure(res)) return;
    const json = await res.json().catch(() => ({}));
    if(!res.ok || !json.success){
      const err = json.error || {};
      const requestId = err.requestId || json.requestId;
      throw new Error(`${err.code ? `${err.code}: ` : ''}${err.message || 'Rejection request failed.'}${requestId ? ` Request ID: ${requestId}` : ''}`);
    }

    closeRejectConfirmation();
    detailCache.clear();
    await loadActions();
    if(!$('actionDetailOverlay')?.hidden){
      const refreshed = await fetchActionDetail(action.id);
      if(refreshed) openActionDetail(refreshed);
    }
    setMessage('Action rejected internally with founder reason. Executed: no · Queued: no · External writes remain off.', 'success');
  }catch(error){
    console.error('Reject confirmation failed', error);
    setRejectConfirmMessage(error.message || 'Rejection failed safely.', 'error');
  }finally{
    setFinalRejectBusy(false);
  }
}


const CANCELLABLE_MOBILE_STATUSES = ['proposed', 'approval_required', 'auto_approved', 'approved', 'queued'];
function canOpenCancelConfirmation(action){
  if(!action || !action.id) return false;
  return CANCELLABLE_MOBILE_STATUSES.includes(String(action.status || '').toLowerCase());
}
function setCancelConfirmMessage(text, kind = ''){
  const el = $('cancelConfirmMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : (kind === 'warn' ? 'note warn' : 'note compact-note'));
}
function setFinalCancelBusy(isBusy){
  cancelConfirmState.busy = Boolean(isBusy);
  const btn = $('finalCancelActionBtn');
  if(btn){
    btn.disabled = Boolean(isBusy);
    btn.textContent = isBusy ? 'Cancelling…' : 'Final Cancel';
  }
}
function buildCancelWhatHappens(detail){
  const action = getAction(detail);
  if(!canOpenCancelConfirmation(action)) return `This action cannot be cancelled from status: ${label(action.status)}.`;
  return 'The action will be marked cancelled internally before execution. No executor, platform API, publish, send, spend, pause, refund, product edit, or rollback will run.';
}
function openCancelConfirmation(detail){
  if(!detail || !detail.action){
    setMessage('Unable to open cancel confirmation. The action detail endpoint did not return safe review data.', 'error');
    return;
  }
  const action = detail.action;
  const overlay = $('cancelConfirmOverlay');
  const modal = $('cancelConfirmModal');
  const finalButton = $('finalCancelActionBtn');
  if(!overlay || !modal || !finalButton) return;
  cancelConfirmState.detail = detail;
  cancelConfirmState.lastFocusedElement = document.activeElement;
  $('cancelConfirmTitle').textContent = `Cancel: ${action.title || 'Untitled action'}`;
  $('cancelConfirmSubtitle').textContent = `${label(action.actionType)} · ${label(action.status)} · Created ${formatDate(action.createdAt)}`;
  $('cancelWhatHappens').textContent = buildCancelWhatHappens(detail);
  $('cancelCurrentStatus').textContent = label(action.status);
  $('cancelPlatformAffected').textContent = getPlatformForApproval(detail);
  $('cancelRiskLevel').textContent = riskBadgeLabel(action.riskLevel);
  setRiskWarningBox('cancelRiskWarning', detail);
  $('cancelReasonDetails').value = '';
  const eligible = canOpenCancelConfirmation(action);
  finalButton.disabled = !eligible;
  finalButton.setAttribute('aria-disabled', eligible ? 'false' : 'true');
  if(eligible){
    setCancelConfirmMessage('Final cancel will call the existing safe backend cancel endpoint and record an internal cancelled event only.', 'warn');
  }else if(action.status === 'cancelled'){
    setCancelConfirmMessage('This action is already cancelled. No duplicate cancellation is needed.', 'warn');
  }else{
    setCancelConfirmMessage(`This action cannot be cancelled from status: ${label(action.status)}. Executed/failed/rolled-back states require result review or supported rollback handling.`, 'error');
  }
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  focusFirstDialogControl(modal);
}
async function openCancelConfirmationById(id){
  if(!id) return;
  setMessage('Opening internal cancel confirmation…');
  const detail = await fetchActionDetail(id);
  openCancelConfirmation(detail);
}
function closeCancelConfirmation(){
  const overlay = $('cancelConfirmOverlay');
  if(!overlay || overlay.hidden) return;
  overlay.hidden = true;
  if($('actionDetailOverlay')?.hidden && $('approvalConfirmOverlay')?.hidden && $('rejectConfirmOverlay')?.hidden) document.body.style.overflow = '';
  cancelConfirmState.detail = null;
  cancelConfirmState.busy = false;
  const button = $('finalCancelActionBtn');
  if(button){
    button.disabled = false;
    button.textContent = 'Final Cancel';
  }
  if(cancelConfirmState.lastFocusedElement && typeof cancelConfirmState.lastFocusedElement.focus === 'function') cancelConfirmState.lastFocusedElement.focus();
}
async function submitCancelConfirmation(){
  if(cancelConfirmState.busy) return;
  const detail = cancelConfirmState.detail;
  const action = detail?.action;
  if(!action?.id){
    setCancelConfirmMessage('Missing action id. Cancellation cannot continue.', 'error');
    return;
  }
  if(!canOpenCancelConfirmation(action)){
    setCancelConfirmMessage(`This action cannot be cancelled from status: ${label(action.status)}.`, 'error');
    return;
  }
  setFinalCancelBusy(true);
  setCancelConfirmMessage('Recording internal cancellation. No executor or external platform will run.', 'warn');
  try{
    const cancelReason = $('cancelReasonDetails')?.value?.trim() || 'Founder cancelled this pending action from the mobile approval queue.';
    const res = await fetch(`${API_BASE}/api/v1/actions/${encodeURIComponent(action.id)}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_reason: cancelReason })
    });
    if(handleAuthFailure(res)) return;
    const json = await res.json().catch(() => ({}));
    if(!res.ok || !json.success){
      const err = json.error || {};
      const requestId = err.requestId || json.requestId;
      throw new Error(`${err.code ? `${err.code}: ` : ''}${err.message || 'Cancellation request failed.'}${requestId ? ` Request ID: ${requestId}` : ''}`);
    }
    closeCancelConfirmation();
    detailCache.clear();
    await loadActions();
    if(!$('actionDetailOverlay')?.hidden){
      const refreshed = await fetchActionDetail(action.id);
      if(refreshed) openActionDetail(refreshed);
    }
    setMessage('Action cancelled internally. Executed: no · Queued externally: no · External writes remain off.', 'success');
  }catch(error){
    console.error('Cancel confirmation failed', error);
    setCancelConfirmMessage(error.message || 'Cancellation failed safely.', 'error');
  }finally{
    setFinalCancelBusy(false);
  }
}

async function loadActions(options = {}){
  const silent = options.silent === true;
  const reason = options.reason || 'manual';
  if(isLoadingActions){
    if(!silent) setMessage('A refresh is already running. Please wait a moment.', 'warn');
    return;
  }

  isLoadingActions = true;
  setActionsBusy(true);
  updateStatusFilterUi();
  updatePollingUi();
  if(!updateAuthUi()){
    $('actionsList').innerHTML = window.LifeSaverActionCard.renderActionEmpty('Please log in to review workspace actions.');
    $('visibleActionCount').textContent = '0';
    setRefreshState('LOGIN REQUIRED', 'paused');
    isLoadingActions = false;
    setActionsBusy(false);
    return;
  }

  detailCache.clear();
  $('loadState').textContent = silent ? 'CHECKING' : 'LOADING';
  setRefreshState(silent ? 'CHECKING' : 'REFRESHING');
  if(!silent){
    setMessage(reason === 'initial' ? 'Loading workspace-scoped actions…' : 'Refreshing workspace-scoped actions…');
    $('actionsList').innerHTML = '<article class="action-card action-card-loading"><div class="action-card-header"><span class="action-pill">LOADING</span><span class="action-pill risk-low">SAFE</span></div><h3 class="action-card-title">Loading action cards…</h3><p class="action-card-description">Fetching the list endpoint and safe detail previews.</p></article>';
  }

  try{
    const query = buildQuery();
    const res = await fetch(`${API_BASE}/api/v1/actions?${query}`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!json.success || !json.data) throw new Error(json.error?.message || 'Invalid actions response');
    const items = Array.isArray(json.data.items) ? json.data.items : [];
    const fingerprint = computeActionListFingerprint(items);
    const changed = Boolean(lastActionListFingerprint && fingerprint !== lastActionListFingerprint);
    lastActionListFingerprint = fingerprint;
    updateLastRefreshTime();

    if(!items.length){
      $('actionsList').innerHTML = window.LifeSaverActionCard.renderActionEmpty('No actions match the current filters. Run npm.cmd run db:seed:actions:local to create safe local fixtures.');
      $('visibleActionCount').textContent = '0';
      $('loadState').textContent = 'EMPTY';
      setRefreshState(actionPollingEnabled ? 'POLLING ON' : 'POLLING PAUSED', actionPollingEnabled ? '' : 'paused');
      if(!silent || changed) setMessage('No actions found for this workspace/filter set.', 'warn');
      return;
    }

    const details = await Promise.all(items.map((item) => fetchActionDetail(item.id)));
    $('actionsList').innerHTML = items.map((item, index) => window.LifeSaverActionCard.renderActionCard(item, details[index], { detailHref: `#${encodeURIComponent(item.id)}` })).join('');
    const total = json.data.pagination?.total;
    $('visibleActionCount').textContent = total != null ? `${items.length}/${total}` : String(items.length);
    $('loadState').textContent = 'LOADED';
    setRefreshState(actionPollingEnabled ? 'POLLING ON' : 'POLLING PAUSED', actionPollingEnabled ? '' : 'paused');
    const statusMeta = getPrimaryStatusMeta($('statusFilter')?.value || '');
    if(silent){
      if(changed){
        setMessage(`Queue refreshed automatically. New or updated actions detected for ${statusMeta.label}. No external writes were performed.`, 'success');
      }
    }else{
      setMessage(`Loaded ${items.length} action card${items.length === 1 ? '' : 's'} for ${statusMeta.label}. Live refresh is ${actionPollingEnabled ? 'on' : 'paused'} and reads only the safe list/detail endpoints.`, 'success');
    }

    if(hasUnsafeActionDeepLinkMutationParams()){
      clearActionDeepLinkFromUrl();
      setMessage('Unsafe approval link blocked. Email/in-app links may open review only and cannot approve, reject, execute, publish, or rollback automatically.', 'error');
      return;
    }

    const deepLinkId = getDeepLinkedActionId();
    if(deepLinkId && deepLinkId !== lastDeepLinkOpenedId){
      const deepLinkDetail = detailCache.get(deepLinkId) || await fetchActionDetail(deepLinkId);
      if(deepLinkDetail){
        lastDeepLinkOpenedId = deepLinkId;
        openActionDetail(deepLinkDetail);
        await logNotificationOpenedFromDeepLink(deepLinkId);
        setMessage('Secure approval deep link opened. Login was required; this link alone cannot approve or execute anything.', 'success');
      }else if(!silent){
        setMessage('This secure approval deep link could not be opened. The action may not exist in this workspace, or you may not have access.', 'error');
      }
    }
  }catch(error){
    console.error('Unable to load actions', error);
    if(!silent){
      $('actionsList').innerHTML = window.LifeSaverActionCard.renderActionEmpty('Unable to load actions. Check that the API is running and you are logged in.');
      $('visibleActionCount').textContent = '0';
    }
    $('loadState').textContent = 'ERROR';
    setRefreshState('REFRESH ERROR', 'error');
    setMessage(error.message || 'Unable to load actions.', 'error');
  }finally{
    isLoadingActions = false;
    setActionsBusy(false);
  }
}

function logout(){
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  window.location.href = './login.html';
}

['typeFilter','riskFilter'].forEach((id) => { const el = $(id); if(el) el.addEventListener('change', function(){ loadActions({ reason: 'filter-change' }); scheduleActionPolling(); }); });
$('statusFilter')?.addEventListener('change', function(){ updateStatusFilterUi(); loadActions({ reason: 'filter-change' }); scheduleActionPolling(); });
document.querySelectorAll('[data-status-filter]').forEach((button) => {
  button.addEventListener('click', function(){ setStatusFilter(button.getAttribute('data-status-filter') || ''); scheduleActionPolling(); });
});
$('refreshActionsBtn')?.addEventListener('click', function(){ loadActions({ reason: 'manual' }); scheduleActionPolling(); });
$('logoutBtn')?.addEventListener('click', logout);
$('closeActionDetailBtn')?.addEventListener('click', closeActionDetail);
$('actionDetailOverlay')?.addEventListener('click', function(event){ if(event.target === $('actionDetailOverlay')) closeActionDetail(); });
$('closeApprovalConfirmBtn')?.addEventListener('click', closeApprovalConfirmation);
$('cancelApprovalConfirmBtn')?.addEventListener('click', closeApprovalConfirmation);
$('finalApproveActionBtn')?.addEventListener('click', submitApproveConfirmation);
$('approvalConfirmOverlay')?.addEventListener('click', function(event){ if(event.target === $('approvalConfirmOverlay')) closeApprovalConfirmation(); });
$('closeCancelConfirmBtn')?.addEventListener('click', closeCancelConfirmation);
$('dismissCancelConfirmBtn')?.addEventListener('click', closeCancelConfirmation);
$('finalCancelActionBtn')?.addEventListener('click', submitCancelConfirmation);
$('cancelConfirmOverlay')?.addEventListener('click', function(event){ if(event.target === $('cancelConfirmOverlay')) closeCancelConfirmation(); });
$('closeRejectConfirmBtn')?.addEventListener('click', closeRejectConfirmation);
$('cancelRejectConfirmBtn')?.addEventListener('click', closeRejectConfirmation);
$('finalRejectActionBtn')?.addEventListener('click', submitRejectConfirmation);
$('rejectConfirmOverlay')?.addEventListener('click', function(event){ if(event.target === $('rejectConfirmOverlay')) closeRejectConfirmation(); });
document.addEventListener('keydown', function(event){
  trapDialogFocus(event);
  if(event.key === 'Escape'){ closeCancelConfirmation(); closeRejectConfirmation(); closeApprovalConfirmation(); closeActionDetail(); }
});


$('toggleAutoRefreshBtn')?.addEventListener('click', function(){
  actionPollingEnabled = !actionPollingEnabled;
  if(actionPollingEnabled){
    setMessage(`Auto refresh resumed. LIFE.SAVER will check for new actions every ${getPollIntervalLabel()}.`, 'success');
    scheduleActionPolling();
  }else{
    stopActionPolling();
    updatePollingUi();
    setMessage('Auto refresh paused. Use Refresh Actions for manual updates.', 'warn');
  }
});
$('pollingIntervalSelect')?.addEventListener('change', function(){
  updatePollingUi();
  scheduleActionPolling();
  setMessage(`Polling interval updated to ${getPollIntervalLabel()}. This still only reads the safe actions list endpoint.`, 'success');
});
document.addEventListener('visibilitychange', function(){
  if(document.hidden){
    setRefreshState('POLLING PAUSED', 'paused');
  }else{
    updatePollingUi();
    if(actionPollingEnabled) loadActions({ silent: true, reason: 'tab-visible' });
    scheduleActionPolling();
  }
});

document.addEventListener('click', function(event){
  const detailControl = event.target && event.target.closest ? event.target.closest('[data-action-control="detail"]') : null;
  if(detailControl){
    event.preventDefault();
    openActionDetailById(detailControl.getAttribute('data-action-id'));
    return;
  }

  const approveControl = event.target && event.target.closest ? event.target.closest('[data-action-control="approve"]') : null;
  if(approveControl){
    event.preventDefault();
    openApprovalConfirmationById(approveControl.getAttribute('data-action-id'));
    return;
  }

  const cancelControl = event.target && event.target.closest ? event.target.closest('[data-action-control="cancel"]') : null;
  if(cancelControl){
    event.preventDefault();
    openCancelConfirmationById(cancelControl.getAttribute('data-action-id'));
    return;
  }

  const rejectControl = event.target && event.target.closest ? event.target.closest('[data-action-control="reject"]') : null;
  if(!rejectControl) return;
  event.preventDefault();
  openRejectConfirmationById(rejectControl.getAttribute('data-action-id'));
});

document.documentElement.classList.add('ls-actions-v073-ready');
updatePollingUi();
loadActions({ reason: 'initial' }).finally(scheduleActionPolling);
