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
function formatClockTime(date = new Date()){
  try { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return 'just now'; }
}
function setBadge(id, text, kind = ''){
  const el = $(id);
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'warn' ? 'badge warn-badge' : (kind === 'danger' ? 'badge danger-badge' : 'badge');
}
function setMessage(text, kind = ''){
  const el = $('notificationMessage');
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
  if(token){
    setBadge('authState', 'AUTH OK');
  }else{
    setBadge('authState', 'LOGIN NEEDED', 'warn');
  }
  const brand = document.querySelector('.brand span');
  if(brand && user?.email){
    brand.textContent = `In-app approval center · ${user.email}${workspace?.name ? ` · ${workspace.name}` : ''}`;
  }
}
function renderPendingApprovals(items){
  const list = $('pendingApprovalList');
  if(!list) return;
  list.setAttribute('aria-busy', 'false');
  if(!items.length){
    list.innerHTML = `<article class="notification-card empty-card"><strong>No pending approvals</strong><span>Excellent, sir. There are currently no actions waiting for founder approval.</span><div class="notification-card-actions"><a class="btn" href="./actions.html">Open Approval Queue</a></div></article>`;
    setBadge('pendingState', 'CLEAR');
    return;
  }
  setBadge('pendingState', `${items.length} WAITING`, items.some((item) => ['high','critical'].includes(item.riskLevel)) ? 'warn' : '');
  list.innerHTML = items.map((item) => {
    const priority = item.priority || 'normal';
    return `<article class="notification-card">
      <div class="notification-card-header">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="notification-pill priority-${escapeHtml(priority)}">${escapeHtml(label(priority))}</span>
      </div>
      <div class="notification-meta">
        <span class="notification-pill">${escapeHtml(label(item.actionType))}</span>
        <span class="notification-pill risk-${escapeHtml(item.riskLevel)}">${escapeHtml(label(item.riskLevel))}</span>
        <span class="notification-pill">${escapeHtml(label(item.status))}</span>
      </div>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      <span>Created: ${escapeHtml(formatDate(item.createdAt))}</span>
      <div class="notification-card-actions"><a class="btn primary" href="${escapeHtml(item.actionUrl)}">Review in Actions</a></div>
    </article>`;
  }).join('');
}
function renderRecentEvents(items){
  const list = $('recentEventList');
  if(!list) return;
  list.setAttribute('aria-busy', 'false');
  if(!items.length){
    list.innerHTML = `<article class="notification-card empty-card"><strong>No recent events</strong><span>Once actions are proposed, approved, executed, failed, or rolled back, recent events will appear here.</span></article>`;
    setBadge('eventState', 'EMPTY');
    return;
  }
  setBadge('eventState', `${items.length} EVENTS`);
  list.innerHTML = items.map((item) => `<article class="notification-card">
    <div class="notification-card-header">
      <strong>${escapeHtml(label(item.eventType))}</strong>
      <span class="notification-pill risk-${escapeHtml(item.riskLevel)}">${escapeHtml(label(item.riskLevel))}</span>
    </div>
    <span>${escapeHtml(item.actionTitle)}</span>
    <div class="notification-meta">
      <span class="notification-pill">${escapeHtml(label(item.actionType))}</span>
      <span class="notification-pill">${escapeHtml(label(item.fromStatus || 'new'))} → ${escapeHtml(label(item.toStatus || item.actionStatus))}</span>
    </div>
    ${item.message ? `<p>${escapeHtml(item.message)}</p>` : ''}
    <span>${escapeHtml(formatDate(item.createdAt))}</span>
    <div class="notification-card-actions"><a class="btn" href="${escapeHtml(item.actionUrl)}">Open Action</a></div>
  </article>`).join('');
}
function updateCounts(data){
  $('pendingCount').textContent = String(data?.counts?.pendingApprovals ?? 0);
  $('highRiskCount').textContent = String(data?.counts?.highRiskPendingApprovals ?? 0);
  $('eventCount').textContent = String(data?.counts?.recentEvents ?? 0);
  $('lastRefreshTime').textContent = formatClockTime();
}
async function loadPreferences(){
  try{
    const prefs = await fetchJson('/api/v1/notification-preferences');
    const inApp = prefs?.channels?.inApp?.enabled !== false;
    const email = prefs?.channels?.email?.enabled === true;
    $('prefInApp').textContent = inApp ? 'Enabled' : 'Disabled';
    $('prefEmail').textContent = email ? 'Enabled preference' : 'Stored preference only';
    $('prefSlack').textContent = 'Planned later';
    $('preferencesHelp').textContent = `Quiet hours: ${prefs?.quietHours?.enabled ? `${prefs.quietHours.start}–${prefs.quietHours.end} ${prefs.quietHours.timezone}` : 'off'} · Escalation: ${prefs?.escalation?.approvalEscalationMinutes || '—'} minutes. Delivery remains in-app UI only for Phase 10.2.`;
  }catch(error){
    $('preferencesHelp').textContent = 'Preference summary could not be loaded. The notification center itself remains read-only.';
  }
}
async function loadNotificationCenter(){
  try{
    setBadge('loadState', 'LOADING');
    setMessage('Loading notification center…');
    const data = await fetchJson('/api/v1/notifications/center?pendingLimit=10&eventLimit=15');
    updateCounts(data);
    renderPendingApprovals(Array.isArray(data.pendingApprovals) ? data.pendingApprovals : []);
    renderRecentEvents(Array.isArray(data.recentEvents) ? data.recentEvents : []);
    setBadge('loadState', 'CENTER READY');
    setMessage('Notification center refreshed. This page is read-only and safe.', 'success');
  }catch(error){
    setBadge('loadState', 'LOAD FAILED', 'danger');
    setMessage(error.message || 'Unable to load notification center.', 'error');
    const pending = $('pendingApprovalList');
    const events = $('recentEventList');
    if(pending) pending.innerHTML = `<article class="notification-card empty-card"><strong>Unable to load approvals</strong><span>${escapeHtml(error.message || 'Unknown error')}</span></article>`;
    if(events) events.innerHTML = `<article class="notification-card empty-card"><strong>Unable to load events</strong><span>Please check login, API status, and database configuration.</span></article>`;
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
  $('refreshCenterBtn')?.addEventListener('click', () => loadNotificationCenter());
  $('logoutBtn')?.addEventListener('click', logout);
  loadNotificationCenter();
  loadPreferences();
}

document.addEventListener('DOMContentLoaded', boot);
