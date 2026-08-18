const API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';
const TOKEN_KEY = 'lifesaver_auth_token';
const USER_KEY = 'lifesaver_auth_user';
const WORKSPACE_KEY = 'lifesaver_auth_workspace';
const $ = (id) => document.getElementById(id);

function setMessage(text, isError = false) {
  const el = $('loginMessage');
  el.textContent = text;
  el.className = isError ? 'note danger' : 'note green-note';
}

function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data.workspace));
}

function getSafeReturnTo(){
  const params = new URLSearchParams(window.location.search || '');
  const raw = (params.get('returnTo') || params.get('return_to') || '').trim();
  if(!raw) return '';
  if(raw.includes('\\') || raw.startsWith('//') || /^https?:\/\//i.test(raw)) return '';
  const lower = raw.toLowerCase();
  const forbidden = ['access_token','refresh_token','authorization','bearer','api_key','client_secret','password','payload_json','rollback_payload','approve=','reject=','execute=','publish=','rollback=','autoapprove','auto_approve','/api/v1/actions/'];
  if(forbidden.some((fragment) => lower.includes(fragment))) return '';
  if(!(raw.startsWith('/') || raw.startsWith('./'))) return '';
  return raw;
}

function setAuthMode(mode) {
  const isSignup = mode === 'signup';
  $('loginForm').style.display = isSignup ? 'none' : 'flex';
  $('signupForm').style.display = isSignup ? 'flex' : 'none';
  $('showLogin').className = isSignup ? 'btn' : 'btn primary';
  $('showSignup').className = isSignup ? 'btn primary' : 'btn';
  setMessage(isSignup
    ? 'Create a private workspace. After signup, continue to onboarding and connect Triple Whale.'
    : 'Login with an existing founder/customer account.');
}

$('showLogin')?.addEventListener('click', () => setAuthMode('login'));
$('showSignup')?.addEventListener('click', () => setAuthMode('signup'));

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('loginButton');
  button.disabled = true;
  button.textContent = 'Checking…';

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value }),
    });
    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || 'Login failed.');
    }

    saveSession(json.data);
    const returnTo = getSafeReturnTo();
    const onboardingStatus = json.data.workspace?.onboardingStatus || '';
    const nextUrl = returnTo || (onboardingStatus && onboardingStatus !== 'dashboard_ready' ? './onboarding.html' : './admin.html');
    setMessage(returnTo ? 'Login successful. Opening the secure approval deep link…' : 'Login successful. Opening LIFE.SAVER…');
    setTimeout(() => { window.location.href = nextUrl; }, 500);
  } catch (error) {
    setMessage(error.message || 'Login failed.', true);
  } finally {
    button.disabled = false;
    button.textContent = 'Login';
  }
});

$('signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('signupButton');
  button.disabled = true;
  button.textContent = 'Creating…';

  try {
    const payload = {
      fullName: $('signupFullName').value.trim(),
      workspaceName: $('signupWorkspaceName').value.trim(),
      email: $('signupEmail').value.trim(),
      password: $('signupPassword').value,
    };

    const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || 'Signup failed.');
    }

    saveSession(json.data);
    setMessage('Workspace created. Opening onboarding…');
    setTimeout(() => { window.location.href = './onboarding.html'; }, 600);
  } catch (error) {
    setMessage(error.message || 'Signup failed.', true);
  } finally {
    button.disabled = false;
    button.textContent = 'Create Workspace';
  }
});
