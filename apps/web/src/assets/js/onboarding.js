const API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';
const TOKEN_KEY = 'lifesaver_auth_token';
const $ = (id) => document.getElementById(id);

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function goLoginIfNeeded(json) {
  if (json && json.error && ['AUTH_REQUIRED', 'INVALID_TOKEN'].includes(json.error.code)) {
    window.location.href = './login.html';
    return true;
  }
  return false;
}

function renderStatus(data) {
  const pct = Number(data.progress?.percent || 0);
  $('progressBar').style.width = `${pct}%`;
  $('progressText').textContent = `${pct}% complete`;
  $('workspaceName').textContent = `${data.workspace?.name || 'Workspace'} · ${data.workspace?.onboardingStatus || 'onboarding'}`;
  $('onboardingMessage').textContent = data.message || 'Continue onboarding.';

  $('stepsList').innerHTML = (data.steps || []).map(step => `
    <div class="onboarding-step ${step.completed ? 'done' : 'pending'}">
      <div>
        <strong>${escapeHtml(step.title)}</strong>
        <p>${escapeHtml(step.description)}</p>
      </div>
      <div class="onboarding-step-action">
        <span class="status ${step.completed ? 'ready' : 'mock'}">${step.completed ? 'DONE' : 'NEXT'}</span>
        <a class="btn" href="${escapeHtml(step.actionUrl)}">${escapeHtml(step.actionLabel)}</a>
      </div>
    </div>
  `).join('');

  $('workspaceDetails').innerHTML = `
    <div class="row"><strong>Name</strong><small>${escapeHtml(data.workspace?.name || '—')}</small></div>
    <div class="row"><strong>Slug</strong><small>${escapeHtml(data.workspace?.slug || '—')}</small></div>
    <div class="row"><strong>Plan</strong><small>${escapeHtml(data.workspace?.planKey || '—')}</small></div>
    <div class="row"><strong>Workspace Status</strong><small>${escapeHtml(data.workspace?.status || '—')}</small></div>
    <div class="row"><strong>Triple Whale</strong><small>${data.flags?.hasTripleWhaleConnection ? 'Connected' : 'Not connected'}</small></div>
    <div class="row"><strong>Metrics Snapshot</strong><small>${data.flags?.hasMetricsSnapshot ? 'Available' : 'Missing'}</small></div>
    <div class="row"><strong>Daily Brief</strong><small>${data.flags?.hasDailyBrief ? 'Generated' : 'Missing'}</small></div>
    <div class="row"><strong>Weekly Summary</strong><small>${data.flags?.hasWeeklySummary ? 'Generated' : 'Missing'}</small></div>
    <div class="row"><strong>Safety Mode</strong><small>${escapeHtml(data.safetyMode || 'read_advise_draft_only')}</small></div>
  `;
}

async function loadStatus(refresh = false) {
  try {
    const url = refresh ? `${API_BASE}/api/v1/onboarding/refresh-status` : `${API_BASE}/api/v1/onboarding/status`;
    const response = await fetch(url, { method: refresh ? 'POST' : 'GET', headers: authHeaders() });
    const json = await response.json();
    if (goLoginIfNeeded(json)) return;
    if (!response.ok || !json.success) throw new Error(json.error?.message || 'Could not load onboarding status.');
    renderStatus(json.data);
  } catch (error) {
    $('onboardingMessage').className = 'note danger';
    $('onboardingMessage').textContent = error.message || 'Could not load onboarding status.';
  }
}

$('refreshStatus').addEventListener('click', () => loadStatus(true));
loadStatus();
