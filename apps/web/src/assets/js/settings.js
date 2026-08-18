const API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';
const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'lifesaver_auth_token';
const USER_KEY = 'lifesaver_auth_user';
const WORKSPACE_KEY = 'lifesaver_auth_workspace';


const FALLBACK_TIMEZONES = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'UTC',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Europe/Stockholm',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland'
];

const CURRENCY_OPTIONS = [
  ['USD', 'USD — US Dollar'],
  ['EUR', 'EUR — Euro'],
  ['GBP', 'GBP — British Pound'],
  ['CAD', 'CAD — Canadian Dollar'],
  ['AUD', 'AUD — Australian Dollar'],
  ['NZD', 'NZD — New Zealand Dollar'],
  ['AED', 'AED — UAE Dirham'],
  ['SAR', 'SAR — Saudi Riyal'],
  ['PKR', 'PKR — Pakistani Rupee'],
  ['INR', 'INR — Indian Rupee'],
  ['BDT', 'BDT — Bangladeshi Taka'],
  ['CNY', 'CNY — Chinese Yuan'],
  ['HKD', 'HKD — Hong Kong Dollar'],
  ['SGD', 'SGD — Singapore Dollar'],
  ['JPY', 'JPY — Japanese Yen'],
  ['KRW', 'KRW — South Korean Won'],
  ['MYR', 'MYR — Malaysian Ringgit'],
  ['THB', 'THB — Thai Baht'],
  ['IDR', 'IDR — Indonesian Rupiah'],
  ['PHP', 'PHP — Philippine Peso'],
  ['ZAR', 'ZAR — South African Rand'],
  ['EGP', 'EGP — Egyptian Pound'],
  ['TRY', 'TRY — Turkish Lira'],
  ['CHF', 'CHF — Swiss Franc'],
  ['SEK', 'SEK — Swedish Krona'],
  ['NOK', 'NOK — Norwegian Krone'],
  ['DKK', 'DKK — Danish Krone'],
  ['PLN', 'PLN — Polish Zloty'],
  ['BRL', 'BRL — Brazilian Real'],
  ['MXN', 'MXN — Mexican Peso']
];

function getTimezoneOptions(){
  try{
    if(typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'){
      const zones = Intl.supportedValuesOf('timeZone');
      if(Array.isArray(zones) && zones.length) return zones;
    }
  }catch(_error){
    // Older browsers fall back to the curated list below.
  }
  return FALLBACK_TIMEZONES;
}

function setSelectOptions(selectId, options, placeholder){
  const select = $(selectId);
  if(!select) return;
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = placeholder;
  select.appendChild(blank);
  options.forEach((option) => {
    const opt = document.createElement('option');
    if(Array.isArray(option)){
      opt.value = option[0];
      opt.textContent = option[1];
    }else{
      opt.value = option;
      opt.textContent = option;
    }
    select.appendChild(opt);
  });
}

function ensureSelectValue(selectId, value){
  const select = $(selectId);
  if(!select) return;
  const normalized = value || '';
  if(normalized && !Array.from(select.options).some((option) => option.value === normalized)){
    const opt = document.createElement('option');
    opt.value = normalized;
    opt.textContent = `${normalized} — saved value`;
    select.appendChild(opt);
  }
  select.value = normalized;
}

function initialiseWorkspaceDropdowns(){
  setSelectOptions('timezoneInput', getTimezoneOptions(), 'Select timezone');
  setSelectOptions('currencyInput', CURRENCY_OPTIONS, 'Select currency');
}

function getAuthToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
function authHeaders(){ const token = getAuthToken(); return token ? { Authorization: `Bearer ${token}` } : {}; }
function requireLogin(){ window.location.href = './login.html'; }
function setText(id, value){ const el = $(id); if(el) el.textContent = value == null || value === '' ? '—' : String(value); }
function setMessage(id, text, kind = ''){
  const el = $(id);
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : 'note');
}
function handleAuthFailure(response){
  if(response.status === 401){
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
    requireLogin();
    return true;
  }
  return false;
}
function updateAuthUi(){
  const token = getAuthToken();
  const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  const workspace = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null');
  if(!token){
    setText('authState', 'LOGIN REQUIRED');
    $('authState').className = 'badge warn-badge';
    setText('loggedInUser', 'Not logged in');
    setText('loggedInWorkspace', 'Open Login to manage connected accounts.');
    return false;
  }
  setText('authState', 'AUTHENTICATED');
  $('authState').className = 'badge';
  setText('loggedInUser', user?.email || 'Authenticated');
  setText('loggedInWorkspace', workspace?.name || workspace?.id || 'Workspace loaded');
  return true;
}

async function loadCustomerSettings(){
  if(!getAuthToken()) return;
  try{
    const res = await fetch(`${API_BASE}/api/v1/customer-settings`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success || !json.data) throw new Error(json.error?.message || 'Unable to load customer settings.');
    const d = json.data;
    const profile = d.workspaceProfile || {};
    if($('workspaceNameInput')) $('workspaceNameInput').value = profile.workspaceName || '';
    if($('storeDomainInput')) $('storeDomainInput').value = profile.storeDomain || '';
    ensureSelectValue('timezoneInput', profile.timezone || '');
    ensureSelectValue('currencyInput', profile.currency || '');
    setText('workspaceRoleBadge', `ROLE ${profile.workspaceRole || '—'}`);
    setText('loggedInWorkspace', `${profile.workspaceName || profile.workspaceId || 'Workspace'} · ${profile.planKey || 'plan'} · ${profile.status || 'active'}`);
    if(d.connectionOwnership){
      setText('claudeOwnership', d.connectionOwnership.claude?.note || 'Claude remains platform/backend-owned.');
      setText('tripleWhaleOwnership', d.connectionOwnership.tripleWhale?.note || 'Triple Whale is customer/workspace-owned.');
    }
    setMessage('workspaceProfileMessage', 'Workspace settings loaded for this authenticated customer workspace.', 'success');
  }catch(error){
    setMessage('workspaceProfileMessage', error.message || 'Unable to load customer settings.', 'error');
  }
}

const workspaceProfileForm = $('workspaceProfileForm');
if(workspaceProfileForm){
  workspaceProfileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('saveWorkspaceProfileBtn');
    if(button){ button.disabled = true; button.textContent = 'Saving…'; }
    setMessage('workspaceProfileMessage', 'Saving workspace profile…');
    try{
      const payload = {
        workspaceName: $('workspaceNameInput')?.value || '',
        storeDomain: $('storeDomainInput')?.value || '',
        timezone: $('timezoneInput')?.value || '',
        currency: ($('currencyInput')?.value || '').toUpperCase(),
      };
      const res = await fetch(`${API_BASE}/api/v1/customer-settings/workspace-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to save workspace profile.');
      if(json.data?.workspaceProfile){
        const workspace = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null') || {};
        workspace.name = json.data.workspaceProfile.workspaceName;
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
      }
      setMessage('workspaceProfileMessage', json.data?.message || 'Workspace profile saved.', 'success');
      await loadCustomerSettings();
    }catch(error){
      setMessage('workspaceProfileMessage', error.message || 'Unable to save workspace profile.', 'error');
    }finally{
      if(button){ button.disabled = false; button.textContent = 'Save Workspace Profile'; }
    }
  });
}

async function loadTripleWhaleStatus(){
  if(!getAuthToken()) return;
  try{
    const res = await fetch(`${API_BASE}/api/v1/connect/triplewhale/status`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!json.success || !json.data) throw new Error('Invalid Triple Whale status response.');
    const d = json.data;
    setText('twStatus', d.status || 'unknown');
    setText('twKeyHint', d.keyHint || 'No key stored');
    setText('twLastConnected', d.lastConnectedAt ? new Date(d.lastConnectedAt).toLocaleString() : 'Never');
    setText('twUpdatedAt', d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '—');
    if(d.ownership?.note) setText('twAccessRule', d.ownership.note);
    const persistenceMessage = d.persistence?.message || '';
    if(d.persistence?.status === 'decrypt_failed') {
      setMessage('twMessage', persistenceMessage, 'error');
    } else {
      setMessage('twMessage', d.connected ? `Customer-owned Triple Whale key is stored encrypted for this workspace. ${persistenceMessage}` : 'Triple Whale is not connected yet. Workspace owner/admin can paste the customer API key to store it encrypted.');
    }
  }catch(error){
    setText('twStatus', 'ERROR');
    setMessage('twMessage', error.message || 'Unable to load Triple Whale status.', 'error');
  }
}

const tripleWhaleForm = $('tripleWhaleForm');
if(tripleWhaleForm){
  tripleWhaleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const keyInput = $('tripleWhaleApiKey');
    const button = $('connectTripleWhaleBtn');
    const apiKey = keyInput.value.trim();
    if(!apiKey){ setMessage('twMessage', 'Please paste the Triple Whale API key first.', 'error'); return; }
    button.disabled = true;
    button.textContent = 'Encrypting…';
    try{
      const res = await fetch(`${API_BASE}/api/v1/connect/triplewhale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ apiKey })
      });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Connection failed.');
      keyInput.value = '';
      setMessage('twMessage', json.data.message || 'Triple Whale key stored encrypted.', 'success');
      await loadTripleWhaleStatus();
    }catch(error){
      setMessage('twMessage', error.message || 'Unable to store Triple Whale key.', 'error');
    }finally{
      button.disabled = false;
      button.textContent = 'Store / Update Encrypted Key';
    }
  });
}

const disconnectTripleWhaleBtn = $('disconnectTripleWhaleBtn');
if(disconnectTripleWhaleBtn){
  disconnectTripleWhaleBtn.addEventListener('click', async () => {
    if(!confirm('Disconnect Triple Whale and remove the stored encrypted key for this workspace?')) return;
    disconnectTripleWhaleBtn.disabled = true;
    try{
      const res = await fetch(`${API_BASE}/api/v1/connect/triplewhale`, { method: 'DELETE', headers: authHeaders() });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Disconnect failed.');
      setMessage('twMessage', json.data.message || 'Triple Whale disconnected.', 'success');
      await loadTripleWhaleStatus();
    }catch(error){
      setMessage('twMessage', error.message || 'Unable to disconnect Triple Whale.', 'error');
    }finally{
      disconnectTripleWhaleBtn.disabled = false;
    }
  });
}

const testTripleWhaleBtn = $('testTripleWhaleBtn');
if(testTripleWhaleBtn){
  testTripleWhaleBtn.addEventListener('click', async () => {
    testTripleWhaleBtn.disabled = true;
    testTripleWhaleBtn.textContent = 'Testing…';
    setMessage('testMessage', 'Running protected server-side Triple Whale test…');
    try{
      const res = await fetch(`${API_BASE}/api/v1/triple-whale/test-connection`, { method: 'POST', headers: authHeaders() });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Test failed.');
      const d = json.data;
      const preview = d.responsePreview ? ` Preview: ${JSON.stringify(d.responsePreview).slice(0, 500)}` : '';
      setMessage('testMessage', `${d.message} ${d.safeNote || ''}${preview}`, d.success ? 'success' : '');
      await loadTripleWhaleStatus();
    }catch(error){
      setMessage('testMessage', error.message || 'Unable to test Triple Whale connection.', 'error');
    }finally{
      testTripleWhaleBtn.disabled = false;
      testTripleWhaleBtn.textContent = 'Validate Triple Whale Key';
    }
  });
}

const refreshMetricsBtn = $('refreshMetricsBtn');
if(refreshMetricsBtn){
  refreshMetricsBtn.addEventListener('click', async () => {
    refreshMetricsBtn.disabled = true;
    refreshMetricsBtn.textContent = 'Refreshing…';
    setMessage('syncMessage', 'Starting protected Triple Whale validation + metrics snapshot…');
    try{
      const res = await fetch(`${API_BASE}/api/v1/refresh-metrics`, { method: 'POST', headers: authHeaders() });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Refresh failed.');
      const d = json.data;
      setMessage('syncMessage', d.message || 'Metrics snapshot stored successfully.', 'success');
      await loadTripleWhaleStatus();
    }catch(error){
      setMessage('syncMessage', error.message || 'Unable to refresh metrics.', 'error');
    }finally{
      refreshMetricsBtn.disabled = false;
      refreshMetricsBtn.textContent = 'Refresh Metrics Snapshot';
    }
  });
}


function escapeHtml(value){
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function roleLabel(role){
  const value = String(role || 'viewer').toLowerCase();
  if(value === 'owner') return 'Owner';
  if(value === 'admin') return 'Admin';
  if(value === 'member') return 'Member';
  return 'Viewer';
}

function roleDescription(role){
  const value = String(role || 'viewer').toLowerCase();
  if(value === 'owner') return 'Full workspace ownership. Owner transfer is protected in v0.5.3.';
  if(value === 'admin') return 'Can manage workspace settings and the customer-owned Triple Whale connection.';
  if(value === 'member') return 'Can use dashboard, chat, and drafts. Cannot manage Triple Whale key.';
  return 'Read-only dashboard-style access. No settings or connection management.';
}

function renderTeamMembers(data){
  const list = $('teamMembersList');
  if(!list) return;
  const members = Array.isArray(data?.members) ? data.members : [];
  const permissions = data?.permissions || {};
  setText('teamCurrentRole', roleLabel(permissions.currentUserRole || '—').toUpperCase());
  setText('teamCanManage', permissions.canManageTeam ? 'YES' : 'NO');
  setText('teamMemberCount', String(members.length));

  const form = $('teamMemberForm');
  if(form){
    form.style.display = permissions.canInvite ? '' : 'none';
  }

  if(!members.length){
    list.innerHTML = '<div class="ops-empty">No team members found for this workspace.</div>';
    return;
  }

  list.innerHTML = members.map((member) => {
    const role = String(member.workspaceRole || '').toLowerCase();
    const protectedRole = role === 'owner';
    const canManage = Boolean(permissions.canManageTeam) && !protectedRole && member.membershipStatus !== 'removed';
    const roleOptions = ['viewer','member','admin'].map((option) => `<option value="${option}" ${role === option ? 'selected' : ''}>${roleLabel(option)}</option>`).join('');
    const name = escapeHtml(member.fullName || member.email);
    const email = escapeHtml(member.email || '');
    const membershipId = escapeHtml(member.membershipId || '');
    const membershipStatus = escapeHtml(member.membershipStatus || 'unknown');
    const userStatus = escapeHtml(member.userStatus || 'unknown');
    const joinedAt = member.joinedAt ? new Date(member.joinedAt).toLocaleString() : '—';
    return `
      <div class="team-row" data-membership-id="${membershipId}">
        <div class="team-main">
          <div class="team-title"><strong>${name}</strong><span class="ops-pill ${membershipStatus}">${membershipStatus}</span><span class="ops-pill ${escapeHtml(role)}">${roleLabel(role)}</span></div>
          <small>${email} · user ${userStatus} · joined ${escapeHtml(joinedAt)}</small>
          <p>${escapeHtml(roleDescription(role))}</p>
        </div>
        <div class="team-actions">
          ${canManage ? `<select class="team-role-select" data-membership-id="${membershipId}">${roleOptions}</select><button class="btn team-save-role" data-membership-id="${membershipId}" type="button">Save Role</button><button class="btn team-remove" data-membership-id="${membershipId}" type="button">Remove</button>` : `<span class="badge">${protectedRole ? 'OWNER PROTECTED' : 'VIEW ONLY'}</span>`}
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.team-save-role').forEach((button) => {
    button.addEventListener('click', async () => {
      const membershipId = button.getAttribute('data-membership-id');
      const select = list.querySelector(`.team-role-select[data-membership-id="${membershipId}"]`);
      await updateTeamMemberRole(membershipId, select?.value || 'viewer');
    });
  });

  list.querySelectorAll('.team-remove').forEach((button) => {
    button.addEventListener('click', async () => {
      const membershipId = button.getAttribute('data-membership-id');
      if(!confirm('Remove this team member from the current workspace?')) return;
      await removeTeamMember(membershipId);
    });
  });
}

async function loadTeamMembers(){
  if(!getAuthToken()) return;
  try{
    const res = await fetch(`${API_BASE}/api/v1/team/members`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success || !json.data) throw new Error(json.error?.message || 'Unable to load team members.');
    renderTeamMembers(json.data);
    setMessage('teamMessage', json.data.permissions?.safetyNote || 'Team members loaded for this workspace.', 'success');
  }catch(error){
    setMessage('teamMessage', error.message || 'Unable to load team members.', 'error');
  }
}

async function addTeamMember(event){
  event.preventDefault();
  const button = $('addTeamMemberBtn');
  if(button){ button.disabled = true; button.textContent = 'Adding…'; }
  try{
    const payload = {
      email: $('teamEmailInput')?.value || '',
      fullName: $('teamNameInput')?.value || '',
      role: $('teamRoleInput')?.value || 'viewer'
    };
    const res = await fetch(`${API_BASE}/api/v1/team/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to add team member.');
    if($('teamEmailInput')) $('teamEmailInput').value = '';
    if($('teamNameInput')) $('teamNameInput').value = '';
    renderTeamMembers(json.data);
    setMessage('teamMessage', json.data?.message || 'Team member added. Invite emails are not sent yet in v0.5.3.', 'success');
  }catch(error){
    setMessage('teamMessage', error.message || 'Unable to add team member.', 'error');
  }finally{
    if(button){ button.disabled = false; button.textContent = 'Add Team Member'; }
  }
}

async function updateTeamMemberRole(membershipId, role){
  if(!membershipId) return;
  setMessage('teamMessage', 'Updating team member role…');
  try{
    const res = await fetch(`${API_BASE}/api/v1/team/members/${encodeURIComponent(membershipId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ role })
    });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to update role.');
    renderTeamMembers(json.data);
    setMessage('teamMessage', json.data?.message || 'Team member role updated.', 'success');
  }catch(error){
    setMessage('teamMessage', error.message || 'Unable to update role.', 'error');
  }
}

async function removeTeamMember(membershipId){
  if(!membershipId) return;
  setMessage('teamMessage', 'Removing team member…');
  try{
    const res = await fetch(`${API_BASE}/api/v1/team/members/${encodeURIComponent(membershipId)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to remove team member.');
    renderTeamMembers(json.data);
    setMessage('teamMessage', json.data?.message || 'Team member removed.', 'success');
  }catch(error){
    setMessage('teamMessage', error.message || 'Unable to remove team member.', 'error');
  }
}

const teamMemberForm = $('teamMemberForm');
if(teamMemberForm){
  teamMemberForm.addEventListener('submit', addTeamMember);
}
const refreshTeamBtn = $('refreshTeamBtn');
if(refreshTeamBtn){
  refreshTeamBtn.addEventListener('click', loadTeamMembers);
}

const logoutBtn = $('logoutBtn');
if(logoutBtn){
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
    requireLogin();
  });
}

initialiseWorkspaceDropdowns();
if(updateAuthUi()) { loadCustomerSettings(); loadTripleWhaleStatus(); loadTeamMembers(); loadAutonomyStatus(); }

function setProbeMessage(text, kind = ''){
  const el = $('probeMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : 'note');
}

function setRawPreview(value){
  const el = $('rawResponsePreview');
  if(!el) return;
  if(typeof value === 'string'){
    el.textContent = value;
    return;
  }
  try{
    el.textContent = JSON.stringify(value, null, 2);
  }catch(_error){
    el.textContent = 'Unable to render raw response preview.';
  }
}


async function loadLatestRawResponse(kind = 'summary_probe'){
  const button = kind === 'api_key_validation' ? $('loadValidationBtn') : (kind === 'attribution_probe' ? $('loadAttributionBtn') : $('loadRawBtn'));
  if(button){
    button.disabled = true;
    button.textContent = kind === 'api_key_validation' ? 'Loading Validation…' : (kind === 'attribution_probe' ? 'Loading Attribution…' : 'Loading Summary…');
  }
  setProbeMessage(kind === 'api_key_validation'
    ? 'Loading latest API-key validation snapshot preview…'
    : (kind === 'attribution_probe' ? 'Loading latest Attribution/Pixels Probe raw payload preview…' : 'Loading latest Summary Probe raw payload preview…'));
  try{
    const res = await fetch(`${API_BASE}/api/v1/triple-whale/latest-raw-response?kind=${encodeURIComponent(kind)}`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to load latest raw response.');
    const d = json.data;
    if(!d.hasSnapshot){
      setProbeMessage(d.message || 'No raw snapshot stored yet.');
      setRawPreview('No Triple Whale raw payload has been stored yet.');
      return;
    }
    setProbeMessage(d.message || 'Latest raw response preview loaded.', d.fallbackUsed ? '' : 'success');
    setRawPreview(d);
  }catch(error){
    setProbeMessage(error.message || 'Unable to load raw response preview.', 'error');
  }finally{
    if(button){ button.disabled = false; button.textContent = kind === 'api_key_validation' ? 'Load API-Key Validation Snapshot' : (kind === 'attribution_probe' ? 'Load Attribution Probe Response' : 'Load Summary Probe Response'); }
  }
}

async function loadSnapshotHistory(){
  const button = $('snapshotHistoryBtn');
  if(button){ button.disabled = true; button.textContent = 'Loading History…'; }
  setProbeMessage('Loading Triple Whale snapshot history with explicit snapshot kinds…');
  try{
    const res = await fetch(`${API_BASE}/api/v1/triple-whale/snapshot-history`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to load snapshot history.');
    setProbeMessage(json.data.message || 'Snapshot history loaded.', 'success');
    setRawPreview(json.data);
  }catch(error){
    setProbeMessage(error.message || 'Unable to load snapshot history.', 'error');
  }finally{
    if(button){ button.disabled = false; button.textContent = 'Snapshot History'; }
  }
}

const probeSummaryBtn = $('probeSummaryBtn');
if(probeSummaryBtn){
  probeSummaryBtn.addEventListener('click', async () => {
    probeSummaryBtn.disabled = true;
    probeSummaryBtn.textContent = 'Probing…';
    setProbeMessage('Running protected Triple Whale Summary API probe. No raw key is exposed. v0.5.3 stores Summary diagnostics separately from API-key validation snapshots.');
    try{
      const res = await fetch(`${API_BASE}/api/v1/triple-whale/summary-probe`, { method: 'POST', headers: authHeaders() });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Summary probe failed.');
      const d = json.data;
      setProbeMessage(d.message || 'Summary probe completed.', 'success');
      await loadTripleWhaleStatus();
      await loadLatestRawResponse('summary_probe');
    }catch(error){
      setProbeMessage(error.message || 'Unable to run Summary API probe.', 'error');
    }finally{
      probeSummaryBtn.disabled = false;
      probeSummaryBtn.textContent = 'Probe Summary API';
    }
  });
}



const probeAttributionBtn = $('probeAttributionBtn');
if(probeAttributionBtn){
  probeAttributionBtn.addEventListener('click', async () => {
    probeAttributionBtn.disabled = true;
    probeAttributionBtn.textContent = 'Probing Attribution…';
    setProbeMessage('Running protected Triple Whale Pixel/Attribution probe. This is diagnostic only; dashboard attribution remains disabled until exact fields are confirmed.');
    try{
      const res = await fetch(`${API_BASE}/api/v1/triple-whale/attribution-probe`, { method: 'POST', headers: authHeaders() });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Attribution probe failed.');
      const d = json.data;
      setProbeMessage(d.message || 'Attribution/Pixels probe completed.', 'success');
      await loadTripleWhaleStatus();
      await loadLatestRawResponse('attribution_probe');
    }catch(error){
      setProbeMessage(error.message || 'Unable to run Attribution/Pixels API probe.', 'error');
    }finally{
      probeAttributionBtn.disabled = false;
      probeAttributionBtn.textContent = 'Probe Attribution / Pixel API';
    }
  });
}

const loadRawBtn = $('loadRawBtn');
if(loadRawBtn){
  loadRawBtn.addEventListener('click', () => loadLatestRawResponse('summary_probe'));
}

const loadAttributionBtn = $('loadAttributionBtn');
if(loadAttributionBtn){
  loadAttributionBtn.addEventListener('click', () => loadLatestRawResponse('attribution_probe'));
}

const loadValidationBtn = $('loadValidationBtn');
if(loadValidationBtn){
  loadValidationBtn.addEventListener('click', () => loadLatestRawResponse('api_key_validation'));
}

const snapshotHistoryBtn = $('snapshotHistoryBtn');
if(snapshotHistoryBtn){
  snapshotHistoryBtn.addEventListener('click', loadSnapshotHistory);
}

async function loadMappingPreview(){
  const button = $('mappingPreviewBtn');
  if(button){ button.disabled = true; button.textContent = 'Mapping…'; }
  setProbeMessage('Generating v0.5.3 metric mapping preview from the latest Summary Probe snapshot, not API-key validation placeholders…');
  try{
    const res = await fetch(`${API_BASE}/api/v1/triple-whale/mapping-preview`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to generate mapping preview.');
    const d = json.data;
    if(!d.hasSnapshot){
      setProbeMessage(d.message || 'No snapshot available for mapping preview.');
      setRawPreview('No Triple Whale raw payload has been stored yet.');
      return;
    }
    setProbeMessage(d.message || 'Metric mapping safety preview generated.', 'success');
    setRawPreview(d);
  }catch(error){
    setProbeMessage(error.message || 'Unable to generate mapping preview.', 'error');
  }finally{
    if(button){ button.disabled = false; button.textContent = 'Preview Metric Mapping'; }
  }
}

const mappingPreviewBtn = $('mappingPreviewBtn');
if(mappingPreviewBtn){
  mappingPreviewBtn.addEventListener('click', loadMappingPreview);
}


// Master Pause Switch UI (v0.8.3 mobile release QA safety controls)
let autonomyPauseStatus = null;

function autonomyScopePaused(status, scope){
  if(!status) return false;
  if(scope === 'all') return Boolean(status.pauseAllAutonomy);
  if(scope === 'content') return Boolean(status.pauseContentActions);
  if(scope === 'support') return Boolean(status.pauseSupportActions);
  if(scope === 'ads') return Boolean(status.pauseAdsActions);
  if(scope === 'research') return Boolean(status.pauseResearchActions);
  if(scope === 'dev') return Boolean(status.pauseDevActions);
  return false;
}

function autonomyUpdatedAtLabel(value){
  if(!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function setPausePill(id, paused){
  const el = $(id);
  if(!el) return;
  el.textContent = paused ? 'PAUSED' : 'ACTIVE';
  el.className = `ops-pill ${paused ? 'failed' : 'success'}`;
}

function renderAutonomyStatus(status){
  autonomyPauseStatus = status;
  if(!status) return;

  const emergency = status.emergencySafeMode || {};
  const globalPaused = Boolean(status.pauseAllAutonomy);
  const effectiveBlocked = globalPaused || Boolean(emergency.active);
  const permissions = status.permissions || {};
  const canUpdate = Boolean(permissions.canPauseAutonomy || permissions.canResumeAutonomy);

  const stateEl = $('autonomyMasterState');
  if(stateEl){
    stateEl.textContent = emergency.active ? 'EMERGENCY SAFE MODE' : (globalPaused ? 'GLOBAL PAUSED' : 'AUTONOMY ACTIVE');
    stateEl.className = `autonomy-master-state ${effectiveBlocked ? 'paused' : 'active'}`;
  }

  setText('pauseAllState', globalPaused ? 'PAUSED' : 'ACTIVE');
  if($('pauseAllState')) $('pauseAllState').style.color = globalPaused ? 'var(--red)' : 'var(--green)';
  setText('pauseUpdatedBy', status.updatedBy ? `User ${String(status.updatedBy).slice(0, 8)}…` : 'System default');
  setText('pauseUpdatedAt', autonomyUpdatedAtLabel(status.updatedAt));
  setText('pauseEmergencyState', emergency.active ? 'ACTIVE' : 'OFF');
  if($('pauseEmergencyState')) $('pauseEmergencyState').style.color = emergency.active ? 'var(--red)' : 'var(--green)';

  const warningTitle = $('pauseWarningTitle');
  const warningMessage = $('pauseWarningMessage');
  const card = $('autonomySwitchCard');
  if(warningTitle) warningTitle.textContent = emergency.active ? 'Emergency safe mode is active' : (globalPaused ? 'All autonomy is paused' : 'Autonomy pause switch is ready');
  if(warningMessage){
    warningMessage.textContent = emergency.active
      ? (emergency.warning || emergency.reason || 'All future executor execution is blocked by EMERGENCY_SAFE_MODE. Resume buttons do not execute waiting actions.')
      : (globalPaused
        ? 'No future policy auto-approval or executor execution is allowed while the master pause is active. Proposed actions remain reviewable.'
        : 'Future autonomy is not globally paused. Category pause flags, policies, approvals, caps, audit logs, and executor pause checks still apply before any future execution.');
  }
  if(card) card.classList.toggle('paused', effectiveBlocked);

  const btn = $('masterPauseToggleBtn');
  if(btn){
    btn.disabled = !canUpdate;
    btn.textContent = globalPaused ? 'Resume All Autonomy' : 'Pause All Autonomy';
    btn.classList.toggle('danger-action', !globalPaused);
  }

  const categories = [
    ['content','pauseContentState'],
    ['support','pauseSupportState'],
    ['ads','pauseAdsState'],
    ['research','pauseResearchState'],
    ['dev','pauseDevState']
  ];
  categories.forEach(([scope, id]) => {
    const paused = autonomyScopePaused(status, scope);
    setPausePill(id, paused);
    const row = document.querySelector(`.autonomy-category-row[data-scope="${scope}"]`);
    if(row){
      row.classList.toggle('paused', paused || globalPaused || Boolean(emergency.active));
      row.classList.toggle('active', !paused && !globalPaused && !emergency.active);
    }
    const button = document.querySelector(`.autonomy-category-toggle[data-scope="${scope}"]`);
    if(button){
      button.disabled = !canUpdate;
      button.textContent = paused ? `Resume ${scope}` : `Pause ${scope}`;
      button.setAttribute('aria-pressed', paused ? 'true' : 'false');
    }
  });

  setMessage('pauseUiMessage', 'Pause status loaded. Pause/resume changes update internal settings and audit logs only; resume does not execute waiting actions.', 'success');
}

async function loadAutonomyStatus(){
  if(!getAuthToken()) return;
  try{
    setMessage('pauseUiMessage', 'Loading autonomy pause status…');
    const res = await fetch(`${API_BASE}/api/v1/autonomy/status`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success || !json.data) throw new Error(json.error?.message || 'Unable to load autonomy pause status.');
    renderAutonomyStatus(json.data);
  }catch(error){
    setText('autonomyMasterState', 'PAUSE API ERROR');
    if($('autonomyMasterState')) $('autonomyMasterState').className = 'autonomy-master-state paused';
    setMessage('pauseUiMessage', error.message || 'Unable to load autonomy pause status.', 'error');
  }
}

async function updateAutonomyPause(scope, paused){
  const reason = ($('pauseReasonInput')?.value || '').trim();
  const action = paused ? 'pause' : 'resume';
  const label = scope === 'all' ? 'all autonomy' : `${scope} autonomy`;
  const confirmText = paused
    ? `Pause ${label}? This blocks future auto-approval/execution for the selected scope.`
    : `Resume ${label}? This only changes pause state. It will not execute waiting actions.`;
  if(scope === 'all' && !window.confirm(confirmText)) return;

  const button = scope === 'all' ? $('masterPauseToggleBtn') : document.querySelector(`.autonomy-category-toggle[data-scope="${scope}"]`);
  if(button){ button.disabled = true; button.textContent = paused ? 'Pausing…' : 'Resuming…'; }
  setMessage('pauseUiMessage', `${paused ? 'Pausing' : 'Resuming'} ${label}…`);
  try{
    const res = await fetch(`${API_BASE}/api/v1/autonomy/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ scope, reason })
    });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success || !json.data) throw new Error(json.error?.message || `Unable to ${action} autonomy.`);
    renderAutonomyStatus(json.data.status || json.data);
    const audit = json.data.audit || {};
    setMessage('pauseUiMessage', `${label} ${paused ? 'paused' : 'resumed'}. Audit event: ${audit.eventType || 'recorded'}. No queued/executed/external action was triggered.`, 'success');
    if($('pauseReasonInput')) $('pauseReasonInput').value = '';
  }catch(error){
    setMessage('pauseUiMessage', error.message || `Unable to ${action} autonomy.`, 'error');
    await loadAutonomyStatus();
  }finally{
    if(button) button.disabled = false;
  }
}

const masterPauseToggleBtn = $('masterPauseToggleBtn');
if(masterPauseToggleBtn){
  masterPauseToggleBtn.addEventListener('click', () => {
    const currentlyPaused = autonomyScopePaused(autonomyPauseStatus, 'all');
    updateAutonomyPause('all', !currentlyPaused);
  });
}

const refreshPauseStatusBtn = $('refreshPauseStatusBtn');
if(refreshPauseStatusBtn){
  refreshPauseStatusBtn.addEventListener('click', loadAutonomyStatus);
}

document.querySelectorAll('.autonomy-category-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const scope = button.getAttribute('data-scope');
    if(!scope) return;
    const currentlyPaused = autonomyScopePaused(autonomyPauseStatus, scope);
    updateAutonomyPause(scope, !currentlyPaused);
  });
});
