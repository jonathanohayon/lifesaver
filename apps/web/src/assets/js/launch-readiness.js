const API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';
const TOKEN_KEY = 'lifesaver_auth_token';
const USER_KEY = 'lifesaver_auth_user';
const WORKSPACE_KEY = 'lifesaver_auth_workspace';
const $ = (id) => document.getElementById(id);

function getAuthToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
function authHeaders(){ const token = getAuthToken(); return token ? { Authorization: `Bearer ${token}` } : {}; }
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
}
function setText(id, value){ const el = $(id); if(el) el.textContent = value == null || value === '' ? '—' : String(value); }
function boolStatus(value){ return value ? 'YES' : 'NO'; }
function statusClass(check){
  if(check.ok) return 'success';
  if(check.severity === 'critical') return 'error';
  if(check.severity === 'warning') return 'warn';
  return 'info';
}
function listRows(items){
  return (items || []).map((item, index) => `<div class="row"><div><strong>${index + 1}. ${escapeHtml(item)}</strong></div></div>`).join('') || '<div class="ops-empty">No items returned.</div>';
}
function updateAuthUi(){
  const token = getAuthToken();
  const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  const workspace = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null');
  if(!token){
    setText('authState', 'LOGIN REQUIRED');
    $('authState').className = 'badge warn-badge';
    setText('loggedInUser', 'Not logged in');
    setText('loggedInWorkspace', 'Open Login first to access protected launch readiness data.');
    return false;
  }
  setText('authState', 'AUTHENTICATED');
  $('authState').className = 'badge';
  setText('loggedInUser', user?.email || 'Authenticated');
  setText('loggedInWorkspace', workspace?.name || workspace?.id || 'Workspace loaded');
  return true;
}
function logout(){
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  window.location.href = './login.html';
}

async function loadReadiness(){
  updateAuthUi();
  if(!getAuthToken()){
    setText('loadState', 'LOGIN REQUIRED');
    $('loadState').className = 'badge warn-badge';
    return;
  }
  setText('loadState', 'LOADING');
  try{
    const response = await fetch(`${API_BASE}/api/v1/launch-readiness`, { headers: authHeaders() });
    const json = await response.json();
    if(response.status === 401){ logout(); return; }
    if(!response.ok || !json.success) throw new Error(json.error?.message || 'Launch readiness failed to load.');
    const data = json.data;
    setText('loadState', 'API CONNECTED');
    $('loadState').className = 'badge';
    setText('appVersion', data.version || '0.8.3');
    setText('localReady', boolStatus(data.readyForLocalCustomerTesting));
    $('localReady').className = data.readyForLocalCustomerTesting ? 'value green' : 'value amber';
    setText('productionReady', boolStatus(data.readyForProductionCustomerTraffic));
    $('productionReady').className = data.readyForProductionCustomerTraffic ? 'value green' : 'value amber';
    setText('customerAccessMode', data.customerAccessMode);
    setText('domainDeploymentMode', data.domainDeploymentMode);
    setText('launchDomainLabel', data.launchDomainLabel);
    setText('publicSiteUrl', data.configuredUrls?.publicSiteUrl);
    setText('appUrl', data.configuredUrls?.appUrl);
    setText('adminUrl', data.configuredUrls?.adminUrl);
    setText('apiUrl', data.configuredUrls?.apiUrl);
    setText('workerApiBaseUrl', data.configuredUrls?.workerApiBaseUrl);
    $('envPreview').textContent = Object.entries(data.productionEnvTemplate || {}).map(([key, value]) => `${key}=${value}`).join('\n');
    $('checklist').innerHTML = (data.checklist || []).map((check) => `
      <div class="ops-section">
        <div class="ops-item">
          <div>
            <div class="ops-title">${escapeHtml(check.label)}</div>
            <div class="ops-meta">${escapeHtml(check.key)} · severity ${escapeHtml(check.severity)}</div>
            <div class="ops-body">${escapeHtml(check.message)}</div>
          </div>
          <span class="ops-pill ${statusClass(check)}">${check.ok ? 'OK' : 'CHECK'}</span>
        </div>
      </div>
    `).join('');
    $('customerFlow').innerHTML = listRows(data.customerFlow);
    $('adminFlow').innerHTML = listRows(data.adminFlow);
    $('blockedUntilReady').innerHTML = listRows(data.blockedUntilReady);
    $('safetyRules').innerHTML = listRows(data.safetyRules);
  } catch(error){
    setText('loadState', 'ERROR');
    $('loadState').className = 'badge warn-badge';
    $('checklist').innerHTML = `<div class="danger">${escapeHtml(error.message || 'Launch readiness failed to load.')}</div>`;
  }
}

$('logoutBtn')?.addEventListener('click', logout);
loadReadiness();
