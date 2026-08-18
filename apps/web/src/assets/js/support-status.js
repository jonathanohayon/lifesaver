const API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';
const TOKEN_KEY = 'lifesaver_auth_token';
const USER_KEY = 'lifesaver_auth_user';
const WORKSPACE_KEY = 'lifesaver_auth_workspace';
const $ = (id) => document.getElementById(id);

function getAuthToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
function authHeaders(){ const token = getAuthToken(); return token ? { Authorization: `Bearer ${token}` } : {}; }
function readJsonStorage(key){ try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function escapeHtml(value){ return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function label(value){ return String(value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
function formatDate(value){
  if(!value) return '—';
  try { return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch { return value; }
}
function setBadge(id, text, kind = ''){
  const el = $(id);
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'warn' ? 'badge warn-badge' : (kind === 'danger' ? 'badge danger-badge' : 'badge');
}
function setMessage(text, kind = ''){
  const el = $('supportMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger danger-message' : (kind === 'success' ? 'note green-note success-message' : (kind === 'warn' ? 'note warn' : 'note'));
}
async function fetchJson(path){
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  const payload = await res.json().catch(() => ({}));
  if(!res.ok || payload.success === false){
    throw new Error(payload?.error?.message || payload?.message || `Request failed: ${res.status}`);
  }
  return payload.data || payload;
}
function updateAuthUi(){
  const token = getAuthToken();
  const user = readJsonStorage(USER_KEY);
  const workspace = readJsonStorage(WORKSPACE_KEY);
  setBadge('authState', token ? 'AUTH OK' : 'LOGIN NEEDED', token ? '' : 'warn');
  const brand = document.querySelector('.brand span');
  if(brand && user?.email){
    brand.textContent = `Connector status UI · ${user.email}${workspace?.name ? ` · ${workspace.name}` : ''}`;
  }
}
function healthKind(health){
  if(health === 'healthy') return '';
  if(health === 'warning') return 'warn';
  return 'danger';
}
function pillKind(text){
  const lower = String(text || '').toLowerCase();
  if(lower.includes('connected') || lower.includes('valid') || lower.includes('no sync errors')) return 'good';
  if(lower.includes('expired') || lower.includes('missing') || lower.includes('disconnected') || lower.includes('error')) return 'danger';
  if(lower.includes('soon') || lower.includes('warning') || lower.includes('no sync yet')) return 'warn';
  return '';
}
function renderErrors(errors){
  const list = $('syncErrorList');
  if(!list) return;
  list.setAttribute('aria-busy', 'false');
  if(!errors.length){
    list.innerHTML = `<article class="support-error-card empty"><strong>No sync errors</strong><span>The support connector has no recent redacted sync errors in this status snapshot.</span></article>`;
    setBadge('errorState', 'NO ERRORS');
    return;
  }
  setBadge('errorState', `${errors.length} ERROR${errors.length === 1 ? '' : 'S'}`, 'warn');
  list.innerHTML = errors.map((item) => `<article class="support-error-card">
    <strong>${escapeHtml(label(item.code))}</strong>
    <p>${escapeHtml(item.message)}</p>
    <div class="support-error-meta">
      <span class="support-pill ${escapeHtml(pillKind(item.severity))}">${escapeHtml(label(item.severity))}</span>
      <span class="support-pill ${item.retryable ? 'warn' : 'danger'}">${item.retryable ? 'Retryable' : 'Not retryable'}</span>
      <span class="support-pill ${item.redacted ? 'good' : ''}">${item.redacted ? 'Redacted' : 'No sensitive pattern'}</span>
    </div>
    <span>${escapeHtml(formatDate(item.occurredAt))}</span>
  </article>`).join('');
}
function renderStatus(snapshot){
  $('connectorState').textContent = label(snapshot.connectionState);
  $('connectorLabel').textContent = snapshot.connectorLabel || 'Gmail';
  $('lastSync').textContent = formatDate(snapshot.lastSyncAt);
  $('syncErrorCount').textContent = String(snapshot.syncErrorCount || 0);
  $('tokenStatus').textContent = label(snapshot.tokenStatus);
  $('providerName').textContent = snapshot.connectorLabel || label(snapshot.provider);
  $('connectionValue').textContent = snapshot.connectorConnected ? 'Connected' : label(snapshot.connectionState);
  $('lastSuccessfulSync').textContent = formatDate(snapshot.lastSuccessfulSyncAt);
  $('lastAttempt').textContent = formatDate(snapshot.lastAttemptAt);
  $('tokenExpires').textContent = formatDate(snapshot.tokenExpiresAt);
  $('readOnlyScope').textContent = snapshot.readOnlyScopeGranted ? 'Granted' : 'Not granted';
  $('safeToImport').textContent = snapshot.safeToImportReadOnly ? 'Yes' : 'No';
  $('nextAction').textContent = snapshot.nextRecommendedAction || 'Review connector status.';
  $('syncHealthTitle').textContent = label(snapshot.syncHealth);
  setBadge('syncHealthBadge', label(snapshot.syncHealth).toUpperCase(), healthKind(snapshot.syncHealth));
  const badgeList = $('uiBadgeList');
  if(badgeList){
    badgeList.innerHTML = (snapshot.uiBadges || []).map((badge) => `<span class="support-pill ${escapeHtml(pillKind(badge))}">${escapeHtml(badge)}</span>`).join('');
  }
  renderErrors(Array.isArray(snapshot.recentSyncErrors) ? snapshot.recentSyncErrors : []);
}
async function loadCurrentStatus(){
  try{
    setBadge('loadState', 'LOADING');
    setMessage('Loading support connector status…');
    const data = await fetchJson('/api/v1/support/sync-status/current');
    renderStatus(data.snapshot || data);
    setBadge('loadState', 'STATUS READY');
    setMessage('Support connector status refreshed. This page is safe and status-only.', 'success');
  }catch(error){
    setBadge('loadState', 'LOAD FAILED', 'danger');
    setMessage(error.message || 'Unable to load support connector status.', 'error');
    const list = $('syncErrorList');
    if(list) list.innerHTML = `<article class="support-error-card"><strong>Unable to load status</strong><span>${escapeHtml(error.message || 'Unknown error')}</span></article>`;
  }
}
async function loadExample(){
  try{
    setBadge('loadState', 'LOADING EXAMPLE');
    const data = await fetchJson('/api/v1/support/sync-status/example');
    renderStatus(data.connectedWithErrors?.snapshot || data.connectedHealthy?.snapshot || data.disconnected?.snapshot);
    setBadge('loadState', 'QA EXAMPLE');
    setMessage('Loaded a safe QA example with redacted sync errors.', 'success');
  }catch(error){
    setBadge('loadState', 'LOAD FAILED', 'danger');
    setMessage(error.message || 'Unable to load QA example.', 'error');
  }
}

let currentSupportActionReview = null;
async function postJson(path, body){
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body || {}) });
  const payload = await res.json().catch(() => ({}));
  if(!res.ok || payload.success === false){
    throw new Error(payload?.error?.message || payload?.message || `Request failed: ${res.status}`);
  }
  return payload.data || payload;
}
function renderSupportActionReview(review){
  currentSupportActionReview = review || null;
  if(!review) return;
  const ticket = review.ticket || {};
  const controls = review.reviewControls || {};
  $('reviewTicketSubject').textContent = ticket.subjectPreview || 'Support ticket review';
  $('reviewTicketId').textContent = ticket.ticketId || '—';
  $('reviewThreadId').textContent = ticket.threadId || '—';
  $('reviewCustomerHint').textContent = ticket.customerEmailHint || '—';
  $('reviewCategory').textContent = label(ticket.category);
  $('reviewRisk').textContent = label(review.riskLevel);
  $('reviewActionStatus').textContent = label(controls.actionStatus);
  $('reviewTicketSnippet').textContent = ticket.bodySnippetPreview || 'No browser-safe ticket snippet is available.';
  $('reviewSuggestedReply').textContent = review.suggestedReplyPreview || 'No suggested reply is available.';
  const warnings = $('reviewWarnings');
  if(warnings){
    const items = Array.isArray(review.warnings) && review.warnings.length ? review.warnings : ['No support action UI warnings for this review packet.'];
    warnings.innerHTML = items.map((item) => `<span class="support-pill ${escapeHtml(pillKind(item))}">${escapeHtml(item)}</span>`).join('');
  }
  const checklist = $('reviewChecklist');
  if(checklist){
    checklist.innerHTML = (review.founderReviewChecklist || []).map((item) => `<div class="support-checklist-item">✓ ${escapeHtml(item)}</div>`).join('');
  }
  const input = $('supportActionIdInput');
  if(input && controls.actionId) input.value = controls.actionId;
  if($('approveSupportActionBtn')) $('approveSupportActionBtn').disabled = !controls.approveEnabled;
  if($('rejectSupportActionBtn')) $('rejectSupportActionBtn').disabled = !controls.rejectEnabled;
  setBadge('supportActionUiState', controls.approveEnabled ? 'REVIEW READY' : 'READ ONLY', controls.approveEnabled ? '' : 'warn');
}
async function loadSupportActionExample(){
  try{
    setBadge('supportActionUiState', 'LOADING');
    const data = await fetchJson('/api/v1/support/action-ui/example');
    renderSupportActionReview(data.proposedShippingReply || data.sensitiveEscalationReply || data.approvedReadOnlyState);
    setMessage('Loaded support ticket-to-action review example. Approve/reject controls are internal only and do not send email.', 'success');
  }catch(error){
    setBadge('supportActionUiState', 'LOAD FAILED', 'danger');
    setMessage(error.message || 'Unable to load support action UI example.', 'error');
  }
}
function getSelectedSupportActionId(){
  return ($('supportActionIdInput')?.value || currentSupportActionReview?.reviewControls?.actionId || '').trim();
}
async function approveSelectedSupportAction(){
  const actionId = getSelectedSupportActionId();
  if(!actionId){ setMessage('Enter a proposed support action ID before approval.', 'warn'); return; }
  const okToApprove = window.confirm('Approve this internal support_reply_send action? This only approves the action and does not send the email.');
  if(!okToApprove) return;
  try{
    setBadge('supportActionUiState', 'APPROVING');
    await postJson(`/api/v1/actions/${encodeURIComponent(actionId)}/approve`, { approval_note: 'Approved from Phase 12.9 Support Action UI. This approval does not send email.' });
    setBadge('supportActionUiState', 'APPROVED');
    setMessage('Support action approved internally. No email was sent.', 'success');
    if(currentSupportActionReview){ renderSupportActionReview({ ...currentSupportActionReview, reviewControls: { ...currentSupportActionReview.reviewControls, actionStatus: 'approved', approveEnabled: false, rejectEnabled: false, approveEndpoint: null, rejectEndpoint: null } }); }
  }catch(error){
    setBadge('supportActionUiState', 'APPROVE FAILED', 'danger');
    setMessage(error.message || 'Unable to approve support action.', 'error');
  }
}
async function rejectSelectedSupportAction(){
  const actionId = getSelectedSupportActionId();
  if(!actionId){ setMessage('Enter a proposed support action ID before rejection.', 'warn'); return; }
  const reason = window.prompt('Why should this support reply be rejected?');
  if(!reason || !reason.trim()){ setMessage('Rejection reason is required for a safe support action review.', 'warn'); return; }
  try{
    setBadge('supportActionUiState', 'REJECTING');
    await postJson(`/api/v1/actions/${encodeURIComponent(actionId)}/reject`, { rejection_reason: reason.trim() });
    setBadge('supportActionUiState', 'REJECTED', 'warn');
    setMessage('Support action rejected internally. No email was sent.', 'success');
    if(currentSupportActionReview){ renderSupportActionReview({ ...currentSupportActionReview, reviewControls: { ...currentSupportActionReview.reviewControls, actionStatus: 'rejected', approveEnabled: false, rejectEnabled: false, approveEndpoint: null, rejectEndpoint: null } }); }
  }catch(error){
    setBadge('supportActionUiState', 'REJECT FAILED', 'danger');
    setMessage(error.message || 'Unable to reject support action.', 'error');
  }
}

function logout(){
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  updateAuthUi();
  window.location.href = './login.html';
}
function boot(){
  updateAuthUi();
  $('refreshStatusBtn')?.addEventListener('click', loadCurrentStatus);
  $('loadExampleBtn')?.addEventListener('click', loadExample);
  $('logoutBtn')?.addEventListener('click', logout);
  $('loadSupportActionExampleBtn')?.addEventListener('click', loadSupportActionExample);
  $('approveSupportActionBtn')?.addEventListener('click', approveSelectedSupportAction);
  $('rejectSupportActionBtn')?.addEventListener('click', rejectSelectedSupportAction);
  loadCurrentStatus();
  loadSupportActionExample();
}

document.addEventListener('DOMContentLoaded', boot);
