const API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';
const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'lifesaver_auth_token';
const USER_KEY = 'lifesaver_auth_user';
const WORKSPACE_KEY = 'lifesaver_auth_workspace';

function getAuthToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
function authHeaders(){ const token = getAuthToken(); return token ? { Authorization: `Bearer ${token}` } : {}; }
function requireLogin(){ window.location.href = './login.html'; }
function updateAuthUi(){
  const token = getAuthToken();
  const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  const workspace = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null');
  if(!token){
    $('authState').textContent = 'LOGIN REQUIRED';
    $('authState').className = 'badge warn-badge';
    $('loggedInUser').textContent = 'Not logged in';
    $('loggedInWorkspace').textContent = 'Open Login to access protected admin data.';
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
    requireLogin();
    return true;
  }
  return false;
}

function statusClass(value){
  return String(value || '').toLowerCase();
}

function endpointRow(endpoint){
  return `<div class="row"><div><strong>${endpoint.method} ${endpoint.path}</strong><br><small>${endpoint.purpose}</small></div><span class="status ${statusClass(endpoint.status)}">${endpoint.status}</span></div>`;
}

function adminPanelCard(panel){
  return `<div class="card"><h3>${panel.name}</h3><p>${panel.purpose}</p><br><span class="status ${statusClass(panel.status)}">${panel.status}</span></div>`;
}

function eventRow(event){
  const when = event.createdAt ? new Date(event.createdAt).toLocaleString() : '—';
  return `<div class="row"><div><strong>${event.eventType}</strong><br><small>${event.message}</small><br><small>${when}</small></div><span class="status ${statusClass(event.severity)}">${event.severity}</span></div>`;
}

function setCount(id, value){
  const el = $(id);
  if(el) el.textContent = Number.isFinite(value) ? String(value) : '—';
}

function setText(id, value){
  const el = $(id);
  if(el) el.textContent = value == null || value === '' ? '—' : String(value);
}


function renderEmergencySafeMode(emergency){
  const panel = $('emergencySafeModePanel');
  if(!panel) return;
  const active = Boolean(emergency && emergency.active);
  panel.hidden = !active;
  if(!active) return;
  setText('emergencySafeModeMessage', emergency.warning || emergency.reason || 'Emergency safe mode is active. All future executor execution is blocked.');
  setText('emergencySafeModeEnvKey', emergency.envKey || 'EMERGENCY_SAFE_MODE');
  setText('emergencySafeModeExecution', emergency.executionBlocked ? 'BLOCKED' : 'CHECK');
  setText('emergencySafeModeApproval', emergency.autoApprovalAllowed === false ? 'BLOCKED' : 'CHECK');
}

function connectionRow(connection){
  const label = connection.provider === 'triple_whale' ? 'Triple Whale' : connection.provider;
  const workspace = connection.workspaceName ? `${connection.workspaceName}${connection.ownerEmail ? ' · ' + connection.ownerEmail : ''}` : 'Workspace context unavailable';
  const details = [
    workspace,
    connection.keyHint ? `Key hint: ${connection.keyHint}` : 'No stored key',
    connection.lastConnectedAt ? `Connected: ${new Date(connection.lastConnectedAt).toLocaleString()}` : 'Never connected',
    connection.rawKeyVisibleToAdmin === false ? 'Raw key hidden from Super Admin' : 'Raw key visibility unknown',
  ].join(' · ');
  return `<div class="row"><div><strong>${label}</strong><br><small>${details}</small></div><span class="status ${statusClass(connection.status)}">${connection.status}</span></div>`;
}

function setTwMessage(text, kind = ''){
  const el = $('twMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : 'note');
}

function setSyncMessage(text, kind = ''){
  const el = $('syncMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : 'note');
}

function setTestMessage(text, kind = ''){
  const el = $('testMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : 'note');
}

function money(value){
  const num = Number(value);
  return Number.isFinite(num) ? `$${num.toLocaleString()}` : '—';
}

function numberText(value){
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : '—';
}

function roasText(value){
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(2)}x` : '—';
}

async function loadDatabaseStatus(){
  try{
    const res = await fetch(`${API_BASE}/api/v1/database/status`);
    const json = await res.json();
    if(!json.success || !json.data){ throw new Error('Invalid database response'); }
    const d = json.data;

    const statusText = d.connected ? 'CONNECTED' : (d.configured ? 'ERROR' : 'NOT SET');
    $('databaseStatus').textContent = statusText;
    $('databaseStatus').className = `value ${d.connected ? 'green' : 'amber'}`;
    $('databaseMessage').textContent = d.message;
    $('dbConfigured').textContent = d.configured ? 'Yes' : 'No — add DATABASE_URL to .env';
    $('dbConnected').textContent = d.connected ? 'Yes' : 'No';
    $('dbName').textContent = d.databaseName || '—';
    $('dbTime').textContent = d.databaseTime || '—';
  }catch(error){
    $('databaseStatus').textContent = 'API OFFLINE';
    $('databaseMessage').textContent = 'Unable to check database status.';
    console.warn('Unable to load database status', error);
  }
}

async function loadAdminOverview(){
  try{
    const res = await fetch(`${API_BASE}/api/v1/admin/overview`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!json.success || !json.data){ throw new Error('Invalid admin response'); }
    const d = json.data;

    $('appVersion').textContent = d.app.version;
    $('appMode').textContent = d.app.mode;
    $('appEnvironment').textContent = d.app.environment;
    $('currentStage').textContent = d.architecture.currentStage;
    $('v1Scope').textContent = d.architecture.v1Scope;
    $('futureSaas').textContent = d.architecture.futureSaasDirection;
    $('workspaceCurrent').textContent = d.workspaceModel.currentV1;
    $('workspaceFuture').textContent = d.workspaceModel.futureSaas;
    $('workspaceRule').textContent = d.workspaceModel.isolationRule;
    renderEmergencySafeMode(d.emergencySafeMode);

    const summary = d.databaseSummary || {};
    const counts = summary.counts || null;
    if(counts){
      setCount('countUsers', counts.users);
      setCount('countWorkspaces', counts.workspaces);
      setCount('countConnections', counts.connectedAccounts);
      setCount('countEvents', counts.systemEvents);
      setCount('countMetrics', counts.metricsSnapshots);
      setCount('countChats', counts.chatMessages);
      setCount('countBriefs', counts.briefs);
      setCount('countDrafts', counts.drafts);
    }

    $('seedStatus').textContent = summary.seeded ? 'Seeded — default local workspace is ready.' : 'Not seeded yet — run npm.cmd run db:seed after migrations.';

    if(summary.defaultWorkspace){
      const w = summary.defaultWorkspace;
      $('defaultWorkspace').textContent = `${w.name} / ${w.slug || 'no-slug'} / ${w.planKey} / ${w.status}`;
      $('defaultWorkspaceOwner').textContent = w.ownerEmail || '—';
    }else{
      $('defaultWorkspace').textContent = 'No default workspace found.';
      $('defaultWorkspaceOwner').textContent = '—';
    }

    $('latestEvents').innerHTML = (summary.latestEvents && summary.latestEvents.length)
      ? summary.latestEvents.map(eventRow).join('')
      : '<div class="row"><strong>No system events yet. Run db:seed to create the first event.</strong></div>';

    if($('connectionSummaries')){
      $('connectionSummaries').innerHTML = (summary.connectionSummaries && summary.connectionSummaries.length)
        ? summary.connectionSummaries.map(connectionRow).join('')
        : '<div class="row"><strong>No connected accounts yet.</strong></div>';
    }

    const latestSnapshot = summary.latestMetricsSnapshot || null;
    if(latestSnapshot){
      setText('latestMetricSource', latestSnapshot.source || latestSnapshot.provider || 'snapshot');
      setText('latestMetricRevenue', money(latestSnapshot.revenue));
      setText('latestMetricOrders', numberText(latestSnapshot.orders));
      setText('latestMetricRoas', roasText(latestSnapshot.roas));
      setText('latestMetricSnapshotId', latestSnapshot.id);
      setText('latestMetricCreatedAt', latestSnapshot.createdAt ? new Date(latestSnapshot.createdAt).toLocaleString() : '—');
      setText('latestMetricSourceNote', latestSnapshot.sourceNote || 'Latest database metrics snapshot is available.');
    }else{
      setText('latestMetricSource', 'No snapshot');
      setText('latestMetricRevenue', '—');
      setText('latestMetricOrders', '—');
      setText('latestMetricRoas', '—');
      setText('latestMetricSnapshotId', 'No metrics snapshot stored yet.');
      setText('latestMetricCreatedAt', '—');
      setText('latestMetricSourceNote', 'Click Refresh Metrics Snapshot after storing the Triple Whale key.');
    }

    $('adminPanels').innerHTML = d.adminPanels.map(adminPanelCard).join('');
    $('apiEndpoints').innerHTML = d.apiEndpoints.map(endpointRow).join('');
    $('safetyRules').innerHTML = d.safetyRules.map(rule => `<div class="row"><strong>${rule}</strong></div>`).join('');
    $('nextMilestones').innerHTML = d.nextMilestones.map(item => `<div class="row"><strong>${item}</strong></div>`).join('');
  }catch(error){
    $('loadState').textContent = 'API offline';
    $('loadState').className = 'badge';
    console.warn('Unable to load admin overview', error);
  }
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
    setTwMessage(d.persistence?.status === 'decrypt_failed' ? d.persistence.message : (d.connected ? `Triple Whale key is stored encrypted and decryptable. Customer Settings owns key management; Super Admin monitors status only. ${d.persistence?.message || ''}` : 'Triple Whale is not connected yet. Open Customer Settings to store the workspace API key.'), d.persistence?.status === 'decrypt_failed' ? 'error' : '');
  }catch(error){
    setText('twStatus', 'ERROR');
    setTwMessage(error.message || 'Unable to load Triple Whale status.', 'error');
  }
}

const tripleWhaleForm = $('tripleWhaleForm');
if(tripleWhaleForm){
  tripleWhaleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const keyInput = $('tripleWhaleApiKey');
    const button = $('connectTripleWhaleBtn');
    const apiKey = keyInput.value.trim();
    if(!apiKey){ setTwMessage('Please paste the Triple Whale API key first.', 'error'); return; }
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
      setTwMessage(json.data.message || 'Triple Whale key stored encrypted.', 'success');
      await loadTripleWhaleStatus();
      await loadAdminOverview();
    }catch(error){
      setTwMessage(error.message || 'Unable to store Triple Whale key.', 'error');
    }finally{
      button.disabled = false;
      button.textContent = 'Store Encrypted Key';
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
      setTwMessage(json.data.message || 'Triple Whale disconnected.', 'success');
      await loadTripleWhaleStatus();
      await loadAdminOverview();
    }catch(error){
      setTwMessage(error.message || 'Unable to disconnect Triple Whale.', 'error');
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
    setTestMessage('Running protected server-side Triple Whale test…');
    try{
      const res = await fetch(`${API_BASE}/api/v1/triple-whale/test-connection`, { method: 'POST', headers: authHeaders() });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Test failed.');
      const d = json.data;
      const preview = d.responsePreview ? ` Preview: ${JSON.stringify(d.responsePreview).slice(0, 500)}` : '';
      setTestMessage(`${d.message} ${d.safeNote || ''}${preview}`, d.success ? 'success' : '');
      await loadTripleWhaleStatus();
      await loadAdminOverview();
    }catch(error){
      setTestMessage(error.message || 'Unable to test Triple Whale connection.', 'error');
    }finally{
      testTripleWhaleBtn.disabled = false;
      testTripleWhaleBtn.textContent = 'Validate Key';
    }
  });
}

const refreshMetricsBtn = $('refreshMetricsBtn');
if(refreshMetricsBtn){
  refreshMetricsBtn.addEventListener('click', async () => {
    refreshMetricsBtn.disabled = true;
    refreshMetricsBtn.textContent = 'Refreshing…';
    setSyncMessage('Starting protected Triple Whale validation + metrics snapshot…');
    try{
      const res = await fetch(`${API_BASE}/api/v1/refresh-metrics`, { method: 'POST', headers: authHeaders() });
      if(handleAuthFailure(res)) return;
      const json = await res.json();
      if(!res.ok || !json.success) throw new Error(json.error?.message || 'Refresh failed.');
      const d = json.data;
      setSyncMessage(d.message || 'Metrics snapshot stored successfully.', 'success');
      await loadAdminOverview();
      await loadTripleWhaleStatus();
    }catch(error){
      setSyncMessage(error.message || 'Unable to refresh metrics.', 'error');
    }finally{
      refreshMetricsBtn.disabled = false;
      refreshMetricsBtn.textContent = 'Refresh Metrics Snapshot';
    }
  });
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

if(updateAuthUi()) { loadAdminOverview(); loadTripleWhaleStatus(); }
loadDatabaseStatus();

function setProbeMessage(text, kind = ''){
  const el = $('probeMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : 'note');
}

function setRawPreview(value){
  const el = $('rawResponsePreview');
  if(!el) return;
  try{
    el.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
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
    setProbeMessage('Running protected Triple Whale Summary API probe. No raw key is exposed. v0.5.2 stores Summary diagnostics separately from API-key validation snapshots.');
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
  setProbeMessage('Generating v0.5.2 metric mapping preview from the latest Summary Probe snapshot, not API-key validation placeholders…');
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

function setBriefMessage(text, kind = ''){
  const el = $('briefMessage');
  if(!el) return;
  el.textContent = text;
  el.className = kind === 'error' ? 'note danger' : (kind === 'success' ? 'note green-note' : 'note');
}

function setBriefPreview(value){
  const el = $('briefPreview');
  if(!el) return;
  try{ el.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
  catch(_e){ el.textContent = 'Unable to render brief preview.'; }
}

async function generateBrief(type){
  const button = type === 'daily' ? $('generateDailyBriefBtn') : $('generateWeeklySummaryBtn');
  if(button){ button.disabled = true; button.textContent = type === 'daily' ? 'Generating Daily…' : 'Generating Weekly…'; }
  setBriefMessage(`Generating ${type === 'daily' ? 'Daily Brief' : 'Weekly Summary'} from latest stored metrics…`);
  try{
    const endpoint = type === 'daily' ? '/api/v1/brief/generate' : '/api/v1/weekly/generate';
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to generate brief.');
    setBriefMessage(`${type === 'daily' ? 'Daily Brief' : 'Weekly Summary'} generated and stored in PostgreSQL.`, 'success');
    setBriefPreview(json.data);
    await loadAdminOverview();
  }catch(error){
    setBriefMessage(error.message || 'Unable to generate brief.', 'error');
  }finally{
    if(button){ button.disabled = false; button.textContent = type === 'daily' ? 'Generate Daily Brief' : 'Generate Weekly Summary'; }
  }
}

const generateDailyBriefBtn = $('generateDailyBriefBtn');
if(generateDailyBriefBtn){
  generateDailyBriefBtn.addEventListener('click', () => generateBrief('daily'));
}

const generateWeeklySummaryBtn = $('generateWeeklySummaryBtn');
if(generateWeeklySummaryBtn){
  generateWeeklySummaryBtn.addEventListener('click', () => generateBrief('weekly'));
}

async function loadStoredBrief(type){
  const button = type === 'daily' ? $('loadLatestDailyBriefBtn') : $('loadLatestWeeklySummaryBtn');
  if(button){ button.disabled = true; button.textContent = type === 'daily' ? 'Loading Brief…' : 'Loading Weekly…'; }
  setBriefMessage(`Loading latest ${type === 'daily' ? 'Daily Brief' : 'Weekly Summary'} from API…`);
  try{
    const endpoint = type === 'daily' ? '/api/v1/brief' : '/api/v1/weekly';
    const res = await fetch(`${API_BASE}${endpoint}`, { headers: authHeaders() });
    if(handleAuthFailure(res)) return;
    const json = await res.json();
    if(!res.ok || !json.success) throw new Error(json.error?.message || 'Unable to load brief.');
    setBriefMessage(`${type === 'daily' ? 'Daily Brief' : 'Weekly Summary'} loaded.`, 'success');
    setBriefPreview(json.data);
  }catch(error){
    setBriefMessage(error.message || 'Unable to load brief.', 'error');
  }finally{
    if(button){ button.disabled = false; button.textContent = type === 'daily' ? 'Load Latest Brief' : 'Load Latest Weekly Summary'; }
  }
}

const loadLatestDailyBriefBtn = $('loadLatestDailyBriefBtn');
if(loadLatestDailyBriefBtn){
  loadLatestDailyBriefBtn.addEventListener('click', () => loadStoredBrief('daily'));
}

const loadLatestWeeklySummaryBtn = $('loadLatestWeeklySummaryBtn');
if(loadLatestWeeklySummaryBtn){
  loadLatestWeeklySummaryBtn.addEventListener('click', () => loadStoredBrief('weekly'));
}

/* ===== Draft Review / Approval Queue (v0.5.2) ===== */
let adminDraftCache=[];
function escapeAdminHtml(value){
  return String(value==null?'':value).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function shortAdminText(value, max=210){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length>max?`${text.slice(0,max-1)}…`:text;
}
function draftTypeLabel(type){
  return String(type||'draft').replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
}
function setAdminDraftMessage(text, kind=''){
  const el=$('adminDraftMessage');
  if(!el) return;
  el.textContent=text;
  el.className=kind==='error'?'note danger':(kind==='success'?'note green-note':'note');
}
function updateAdminDraftCounts(drafts){
  setText('adminDraftTotal', String(drafts.length));
  setText('adminDraftDraft', String(drafts.filter(d=>d.status==='draft').length));
  setText('adminDraftApproved', String(drafts.filter(d=>d.status==='approved').length));
  setText('adminDraftRejected', String(drafts.filter(d=>d.status==='rejected').length));
}
function renderAdminDrafts(drafts){
  adminDraftCache=drafts||[];
  updateAdminDraftCounts(adminDraftCache);
  const box=$('adminDraftList');
  if(!box) return;
  if(!adminDraftCache.length){
    box.innerHTML='<div class="admin-draft-empty">No saved drafts yet. Create one from the dashboard chat or use the buttons above.</div>';
    return;
  }
  box.innerHTML=adminDraftCache.slice(0,20).map(d=>{
    const status=escapeAdminHtml(d.status||'draft');
    const created=d.createdAt?new Date(d.createdAt).toLocaleString():'—';
    return `<div class="draft-row" data-draft-id="${escapeAdminHtml(d.id)}">
      <div class="draft-row-main">
        <div class="draft-row-title"><strong>${escapeAdminHtml(draftTypeLabel(d.draftType))}</strong><span class="${status}">${status}</span></div>
        <small>${created}</small>
        <p><b>Prompt:</b> ${escapeAdminHtml(shortAdminText(d.prompt,160))}</p>
        <p>${escapeAdminHtml(shortAdminText(d.content,260))}</p>
      </div>
      <div class="draft-row-actions">
        <button class="btn" data-admin-copy-draft="${escapeAdminHtml(d.id)}">Copy</button>
        <button class="btn" data-admin-draft-status="${escapeAdminHtml(d.id)}" data-status="approved">Approve</button>
        <button class="btn" data-admin-draft-status="${escapeAdminHtml(d.id)}" data-status="rejected">Reject</button>
        <button class="btn" data-admin-draft-status="${escapeAdminHtml(d.id)}" data-status="draft">Back to Draft</button>
      </div>
    </div>`;
  }).join('');
}
async function loadAdminDrafts(){
  const button=$('adminLoadDraftsBtn');
  if(button){button.disabled=true;button.textContent='Loading Drafts…';}
  setAdminDraftMessage('Loading saved drafts from PostgreSQL…');
  try{
    const res=await fetch(`${API_BASE}/api/v1/drafts`,{headers:authHeaders()});
    if(handleAuthFailure(res)) return;
    const json=await res.json();
    if(!res.ok||!json.success) throw new Error(json.error?.message||'Unable to load drafts.');
    renderAdminDrafts(json.data.drafts||[]);
    setAdminDraftMessage('Draft queue loaded. Approve/reject updates status only; no external action is taken.', 'success');
  }catch(error){
    setAdminDraftMessage(error.message||'Unable to load drafts.', 'error');
  }finally{
    if(button){button.disabled=false;button.textContent='Load Drafts';}
  }
}
async function updateAdminDraftStatus(draftId,status){
  setAdminDraftMessage(`Updating draft to ${status}…`);
  try{
    const res=await fetch(`${API_BASE}/api/v1/drafts/${encodeURIComponent(draftId)}/status`,{method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({status})});
    if(handleAuthFailure(res)) return;
    const json=await res.json();
    if(!res.ok||!json.success) throw new Error(json.error?.message||'Unable to update draft status.');
    setAdminDraftMessage(`Draft marked ${status}. No posting or sending occurred.`, 'success');
    await loadAdminDrafts();
    await loadAdminOverview();
  }catch(error){setAdminDraftMessage(error.message||'Unable to update draft status.', 'error');}
}
async function copyAdminDraft(draftId){
  const draft=adminDraftCache.find(d=>d.id===draftId);
  if(!draft) return;
  try{await navigator.clipboard.writeText(draft.content||'');setAdminDraftMessage('Draft copied to clipboard. Review before using externally.', 'success');}
  catch(_error){setAdminDraftMessage('Unable to copy automatically.', 'error');}
}
async function createAdminDraft(type){
  const isSupport=type==='support_reply';
  const prompt=window.prompt(isSupport?'Paste the customer issue/ticket for a suggested reply:':'What content should LIFE.SAVER draft?');
  if(!prompt||!prompt.trim()) return;
  const button=isSupport?$('adminCreateSupportDraftBtn'):$('adminCreateContentDraftBtn');
  if(button){button.disabled=true;button.textContent=isSupport?'Drafting Reply…':'Drafting Content…';}
  setAdminDraftMessage('Generating draft for founder approval only…');
  try{
    const endpoint=isSupport?'/api/v1/drafts/support-reply':'/api/v1/drafts/content';
    const body=isSupport?{ticket:prompt,customerName:'Customer',issueType:'general support'}:{prompt,channel:'social/content',tone:'calm, premium, founder-approved'};
    const res=await fetch(`${API_BASE}${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(body)});
    if(handleAuthFailure(res)) return;
    const json=await res.json();
    if(!res.ok||!json.success) throw new Error(json.error?.message||'Unable to create draft.');
    setAdminDraftMessage('Draft created. No external action was taken.', 'success');
    await loadAdminDrafts();
    await loadAdminOverview();
  }catch(error){setAdminDraftMessage(error.message||'Unable to create draft.', 'error');}
  finally{if(button){button.disabled=false;button.textContent=isSupport?'Create Support Reply':'Create Content Draft';}}
}

const adminLoadDraftsBtn=$('adminLoadDraftsBtn'); if(adminLoadDraftsBtn) adminLoadDraftsBtn.addEventListener('click', loadAdminDrafts);
const adminCreateContentDraftBtn=$('adminCreateContentDraftBtn'); if(adminCreateContentDraftBtn) adminCreateContentDraftBtn.addEventListener('click',()=>createAdminDraft('content'));
const adminCreateSupportDraftBtn=$('adminCreateSupportDraftBtn'); if(adminCreateSupportDraftBtn) adminCreateSupportDraftBtn.addEventListener('click',()=>createAdminDraft('support_reply'));
const adminDraftList=$('adminDraftList');
if(adminDraftList){
  adminDraftList.addEventListener('click', event=>{
    const target=event.target;
    if(!(target instanceof HTMLElement)) return;
    const copyId=target.getAttribute('data-admin-copy-draft');
    if(copyId) copyAdminDraft(copyId);
    const draftId=target.getAttribute('data-admin-draft-status');
    const status=target.getAttribute('data-status');
    if(draftId&&status) updateAdminDraftStatus(draftId,status);
  });
}

// Load draft queue after admin auth/overview startup has had a moment to complete.
setTimeout(()=>{ if(getAuthToken()) loadAdminDrafts(); }, 600);

/* ===== Admin Logs + Snapshot History UI Polish (v0.5.2) ===== */
let adminOpsCache = null;
let adminOpsActiveSection = 'snapshots';
function setOpsMessage(text, kind=''){
  const el=$('opsLogMessage');
  if(!el) return;
  el.textContent=text;
  el.className=kind==='error'?'note danger':(kind==='success'?'note green-note':'note');
}
function opsPillClass(value){
  const v=String(value||'unknown').toLowerCase().replace(/[^a-z0-9_]+/g,'_');
  if(v.includes('success')||v.includes('ready')||v.includes('completed')||v.includes('production')) return 'success';
  if(v.includes('error')||v.includes('fail')) return 'error';
  if(v.includes('warn')||v.includes('review')||v.includes('placeholder')) return 'warn';
  return 'info';
}
function updateOpsCounts(data){
  const c=data?.counts||{};
  setText('opsEventCount', String(c.systemEvents ?? data?.systemEvents?.length ?? 0));
  setText('opsSnapshotCount', String(c.metricsSnapshots ?? data?.metricsSnapshots?.length ?? 0));
  setText('opsBriefCount', String(c.briefHistory ?? data?.briefHistory?.length ?? 0));
  setText('opsUsageCount', String(c.usageLogs ?? data?.usageLogs?.length ?? 0));
}
function renderOpsJson(value){
  if(!value || (typeof value==='object' && !Object.keys(value).length)) return '';
  try{return `<pre class="ops-json">${escapeAdminHtml(JSON.stringify(value,null,2))}</pre>`;}catch(_e){return '';}
}
function renderOpsSnapshots(items){
  if(!items?.length) return '<div class="ops-empty">No metrics snapshots found yet.</div>';
  return `<div class="ops-section"><h3>Metrics Snapshot Timeline</h3><div class="ops-table">${items.map(s=>{
    const when=s.createdAt?new Date(s.createdAt).toLocaleString():'—';
    const ready=s.coreMetricsProductionReady||s.productionReady?'Core metrics ready':'Needs review';
    const status=s.coreMetricsProductionReady||s.productionReady?'ready':(s.kind||s.sourceStatus||'needs_review');
    return `<div class="ops-item">
      <div>
        <div class="ops-title">${escapeAdminHtml(s.kind||'snapshot')} · ${escapeAdminHtml(s.provider||'provider')}</div>
        <div class="ops-meta">${when} · ${escapeAdminHtml(s.dateRange||'date range')} · ${escapeAdminHtml(s.id||'')}</div>
        <div class="ops-body">Revenue: ${money(s.revenue)} · Orders: ${numberText(s.orders)} · Ad Spend: ${money(s.adSpend)} · ROAS: ${roasText(s.roas)} · Raw: ${numberText(s.rawPayloadSizeChars)} chars</div>
        <div class="ops-body">Source: ${escapeAdminHtml(s.source||'—')} · ${escapeAdminHtml(s.sourceStatus||'—')}</div>
      </div>
      <span class="ops-pill ${opsPillClass(status)}">${escapeAdminHtml(ready)}</span>
    </div>`;
  }).join('')}</div></div>`;
}
function renderOpsEvents(items){
  if(!items?.length) return '<div class="ops-empty">No system events found yet.</div>';
  return `<div class="ops-section"><h3>System Events</h3><div class="ops-table">${items.map(e=>{
    const when=e.createdAt?new Date(e.createdAt).toLocaleString():'—';
    return `<div class="ops-item">
      <div>
        <div class="ops-title">${escapeAdminHtml(e.eventType||'event')}</div>
        <div class="ops-meta">${when} · ${escapeAdminHtml(e.id||'')}</div>
        <div class="ops-body">${escapeAdminHtml(e.message||'')}</div>
        ${renderOpsJson(e.metadata)}
      </div>
      <span class="ops-pill ${opsPillClass(e.severity)}">${escapeAdminHtml(e.severity||'info')}</span>
    </div>`;
  }).join('')}</div></div>`;
}
function renderOpsBriefs(items){
  if(!items?.length) return '<div class="ops-empty">No brief records found yet.</div>';
  return `<div class="ops-section"><h3>Brief History</h3><div class="ops-table">${items.map(b=>{
    const when=b.createdAt?new Date(b.createdAt).toLocaleString():'—';
    const status=b.productionReady?'production ready':(b.sourceStatus||'needs review');
    return `<div class="ops-item">
      <div>
        <div class="ops-title">${escapeAdminHtml(draftTypeLabel(b.type||'brief'))}</div>
        <div class="ops-meta">${when} · Source snapshot: ${escapeAdminHtml(b.sourceSnapshotId||'none')}</div>
        <div class="ops-body">${escapeAdminHtml(b.contentPreview||'')}</div>
      </div>
      <span class="ops-pill ${opsPillClass(status)}">${escapeAdminHtml(status)}</span>
    </div>`;
  }).join('')}</div></div>`;
}
function renderOpsUsage(items){
  if(!items?.length) return '<div class="ops-empty">No usage logs found yet. Live Claude usage appears here after server-side calls.</div>';
  return `<div class="ops-section"><h3>AI / Usage Logs</h3><div class="ops-table">${items.map(u=>{
    const when=u.createdAt?new Date(u.createdAt).toLocaleString():'—';
    const cost=Number(u.estimatedCostUsd||0);
    return `<div class="ops-item">
      <div>
        <div class="ops-title">${escapeAdminHtml(u.eventType||'usage')}</div>
        <div class="ops-meta">${when} · ${escapeAdminHtml(u.provider||'provider')} · ${escapeAdminHtml(u.model||'model')}</div>
        <div class="ops-body">Tokens in: ${numberText(u.tokensIn)} · Tokens out: ${numberText(u.tokensOut)} · Est. cost: $${cost.toFixed(6)}</div>
        ${renderOpsJson(u.metadata)}
      </div>
      <span class="ops-pill info">usage</span>
    </div>`;
  }).join('')}</div></div>`;
}
function renderAdminOps(section='snapshots'){
  const box=$('opsLogBoard');
  if(!box) return;
  if(!adminOpsCache){ box.innerHTML='<div class="admin-draft-empty">Admin logs not loaded yet.</div>'; return; }
  adminOpsActiveSection=section;
  const parts=[];
  if(section==='all'||section==='snapshots') parts.push(renderOpsSnapshots(adminOpsCache.metricsSnapshots));
  if(section==='all'||section==='events') parts.push(renderOpsEvents(adminOpsCache.systemEvents));
  if(section==='all'||section==='briefs') parts.push(renderOpsBriefs(adminOpsCache.briefHistory));
  if(section==='all'||section==='usage') parts.push(renderOpsUsage(adminOpsCache.usageLogs));
  box.innerHTML=parts.join('') || '<div class="ops-empty">No admin log data available.</div>';
}
async function loadAdminOperationsLog(section='snapshots'){
  const button=$('loadOpsLogBtn');
  if(button){button.disabled=true;button.textContent='Loading Logs…';}
  setOpsMessage('Loading Super Admin operations log from PostgreSQL…');
  try{
    const res=await fetch(`${API_BASE}/api/v1/admin/operations-log?limit=30`,{headers:authHeaders()});
    if(handleAuthFailure(res)) return;
    const json=await res.json();
    if(!res.ok||!json.success) throw new Error(json.error?.message||'Unable to load admin operations log.');
    adminOpsCache=json.data;
    updateOpsCounts(adminOpsCache);
    renderAdminOps(section);
    setOpsMessage(adminOpsCache.message||'Admin operations log loaded.', 'success');
  }catch(error){
    setOpsMessage(error.message||'Unable to load admin operations log.', 'error');
  }finally{
    if(button){button.disabled=false;button.textContent='Load Admin Logs';}
  }
}
const loadOpsLogBtn=$('loadOpsLogBtn'); if(loadOpsLogBtn) loadOpsLogBtn.addEventListener('click',()=>loadAdminOperationsLog('all'));
const showOpsSnapshotsBtn=$('showOpsSnapshotsBtn'); if(showOpsSnapshotsBtn) showOpsSnapshotsBtn.addEventListener('click',()=>{ if(adminOpsCache) renderAdminOps('snapshots'); else loadAdminOperationsLog('snapshots'); });
const showOpsEventsBtn=$('showOpsEventsBtn'); if(showOpsEventsBtn) showOpsEventsBtn.addEventListener('click',()=>{ if(adminOpsCache) renderAdminOps('events'); else loadAdminOperationsLog('events'); });
const showOpsBriefsBtn=$('showOpsBriefsBtn'); if(showOpsBriefsBtn) showOpsBriefsBtn.addEventListener('click',()=>{ if(adminOpsCache) renderAdminOps('briefs'); else loadAdminOperationsLog('briefs'); });
const showOpsUsageBtn=$('showOpsUsageBtn'); if(showOpsUsageBtn) showOpsUsageBtn.addEventListener('click',()=>{ if(adminOpsCache) renderAdminOps('usage'); else loadAdminOperationsLog('usage'); });
setTimeout(()=>{ if(getAuthToken()) loadAdminOperationsLog('snapshots'); }, 900);

/* ===== Worker Workspace Query Compatibility Fix (v0.5.2) ===== */
function setSecurityMessage(message,type){ const el=$('securityStatusMessage'); if(el){el.textContent=message; el.className=`note ${type==='error'?'warn':''}`;} }
function securityPill(check){ return check.ok ? 'success' : (check.severity==='critical'?'error':'warn'); }
function renderSecurityStatus(data){
  const board=$('securityStatusBoard');
  if(!board) return;
  $('securityProductionReady') && ($('securityProductionReady').textContent = data.productionReady ? 'YES' : 'NO');
  $('securityCriticalFailures') && ($('securityCriticalFailures').textContent = String(data.criticalFailures ?? 0));
  $('securityWarnings') && ($('securityWarnings').textContent = String(data.warnings ?? 0));
  $('securityMode') && ($('securityMode').textContent = String(data.mode || '—'));
  const checks=(data.checks||[]).map(c=>`<div class="ops-item">
    <div>
      <div class="ops-title">${escapeAdminHtml(c.key||'check')}</div>
      <div class="ops-meta">Severity: ${escapeAdminHtml(c.severity||'info')}</div>
      <div class="ops-body">${escapeAdminHtml(c.message||'')}</div>
    </div>
    <span class="ops-pill ${opsPillClass(securityPill(c))}">${c.ok?'ok':'fix'}</span>
  </div>`).join('');
  const controls = data.activeSecurityControls ? renderOpsJson(data.activeSecurityControls) : '';
  const envSep = data.environmentSeparation ? renderOpsJson(data.environmentSeparation) : '';
  board.innerHTML = `<div class="ops-section"><h3>Security Checks</h3><div class="ops-table">${checks||'<div class="ops-empty">No checks returned.</div>'}</div></div><div class="ops-section"><h3>Environment Separation</h3>${envSep || '<div class="ops-empty">No environment separation status returned.</div>'}</div><div class="ops-section"><h3>Active Controls</h3>${controls}</div>`;
}
async function loadSecurityStatus(){
  const button=$('loadSecurityStatusBtn');
  if(button){button.disabled=true;button.textContent='Loading Security…';}
  setSecurityMessage('Loading production security status…');
  try{
    const res=await fetch(`${API_BASE}/api/v1/security/status`,{headers:authHeaders()});
    if(handleAuthFailure(res)) return;
    const json=await res.json();
    if(!res.ok||!json.success) throw new Error(json.error?.message||'Unable to load security status.');
    renderSecurityStatus(json.data);
    setSecurityMessage(json.data.productionReady ? 'Security checks passed for current mode.' : 'Security checks loaded. Fix critical items before production.', json.data.productionReady?'success':'error');
  }catch(error){
    setSecurityMessage(error.message||'Unable to load security status.', 'error');
  }finally{
    if(button){button.disabled=false;button.textContent='Load Security Status';}
  }
}
const loadSecurityStatusBtn=$('loadSecurityStatusBtn'); if(loadSecurityStatusBtn) loadSecurityStatusBtn.addEventListener('click', loadSecurityStatus);
