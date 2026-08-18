const API_BASE = window.LIFE_SAVER_API_BASE || 'http://localhost:4000';
const TOKEN_KEY = 'lifesaver_auth_token';
const USER_KEY = 'lifesaver_auth_user';
const WORKSPACE_KEY = 'lifesaver_current_workspace';
const RULE_PREVIEW_KEY = 'lifesaver_rule_wizard_preview_v0_6_0_phase_7_10';
const CONTENT_RULE_PREVIEW_KEY = 'lifesaver_content_rule_preview_v0_6_0_phase_7_10';
const SUPPORT_RULE_PREVIEW_KEY = 'lifesaver_support_rule_preview_v0_6_0_phase_7_10';
const ADS_RULE_PREVIEW_KEY = 'lifesaver_ads_rule_preview_v0_6_0_phase_7_10';
const CAPS_PREVIEW_KEY = 'lifesaver_caps_preview_v0_6_0_phase_7_10';
const SIMULATION_PREVIEW_KEY = 'lifesaver_rule_simulation_preview_v0_6_0_phase_7_10';
const POLICY_AUDIT_PREVIEW_KEY = 'lifesaver_policy_audit_preview_v0_6_0_phase_7_10';
const RULES_PERMISSION_QA_KEY = 'lifesaver_rules_permission_qa_v0_6_0_phase_7_10';
const TOTAL_WIZARD_STEPS = 7;
const SUPPORTED_CONDITION_OPERATORS = ['equals','contains','less_than','greater_than','channel_is','risk_below','confidence_above','amount_below'];
let currentWizardStep = 1;
function $(id){ return document.getElementById(id); }
function getToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
function safeJsonParse(value, fallback){ try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function setText(id, value){ const el = $(id); if (el) el.textContent = value; }
function escapeHtml(value){ return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function label(value){ return String(value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
function setBadge(el, state){ if(!el) return; el.classList.remove('safe','open','blocked','paused','ask','auto','block'); if(state) el.classList.add(state); }
function labelBool(value){ return value ? 'PAUSED' : 'OPEN'; }
let lastPauseIntegrationState = {
  status: 'unknown',
  globalPaused: null,
  contentPaused: null,
  supportPaused: null,
  adsPaused: null,
};
function renderPauseIntegrationDisplay(globalPaused, contentPaused, supportPaused, adsPaused, source){
  lastPauseIntegrationState = { status: source || 'loaded', globalPaused, contentPaused, supportPaused, adsPaused };
  const banner = $('pauseOverrideWarning');
  const badge = $('pauseOverrideStateBadge');
  const scopeList = $('pauseOverrideScopeList');
  const impact = $('pauseOverrideRuleImpact');
  if (!banner) return;
  banner.classList.remove('paused','partial','open','unknown');
  setBadge(badge, '');

  const scopeItems = [
    `Global pause: ${globalPaused === null ? 'unknown' : labelBool(Boolean(globalPaused))}`,
    `Content pause: ${contentPaused === null ? 'unknown' : labelBool(Boolean(contentPaused))}`,
    `Support pause: ${supportPaused === null ? 'unknown' : labelBool(Boolean(supportPaused))}`,
    `Ads pause: ${adsPaused === null ? 'unknown' : labelBool(Boolean(adsPaused))}`,
  ];
  if (scopeList) scopeList.innerHTML = scopeItems.map((item) => `<li>${item}</li>`).join('');

  if (globalPaused === true) {
    banner.classList.add('paused');
    setText('pauseOverrideStateBadge', 'GLOBAL PAUSED');
    setBadge(badge, 'paused');
    setText('pauseOverrideHeadline', 'Auto-run is currently paused globally.');
    setText('pauseOverrideMessage', 'Global pause overrides auto-approval, rule simulation, future executors, and every automation category. Proposed actions should be blocked or held for manual review until pause is resumed.');
    if (impact) impact.innerHTML = '<strong>Pause override active:</strong> no future auto-run should happen while global pause is active. Most-restrictive-wins means pause beats auto-approve.';
    const simPause = $('simMasterPauseActive');
    if (simPause) simPause.value = 'yes';
  } else if (contentPaused || supportPaused || adsPaused) {
    const pausedCategories = [contentPaused ? 'Content' : null, supportPaused ? 'Support' : null, adsPaused ? 'Ads' : null].filter(Boolean).join(', ');
    banner.classList.add('partial');
    setText('pauseOverrideStateBadge', 'CATEGORY PAUSED');
    setBadge(badge, 'ask');
    setText('pauseOverrideHeadline', `Auto-run is paused for: ${pausedCategories}.`);
    setText('pauseOverrideMessage', 'Category pause overrides auto-approval for matching action categories. Other categories still remain protected by default ask, caps, risk checks, and most-restrictive-wins conflict resolution.');
    if (impact) impact.innerHTML = `<strong>Category pause active:</strong> ${pausedCategories} automation should stay blocked or ask/manual review depending on the proposed action category.`;
    const simPause = $('simMasterPauseActive');
    if (simPause) simPause.value = 'no';
  } else if (globalPaused === false) {
    banner.classList.add('open');
    setText('pauseOverrideStateBadge', 'NOT PAUSED');
    setBadge(badge, 'open');
    setText('pauseOverrideHeadline', 'No pause override is currently active.');
    setText('pauseOverrideMessage', 'Rules still default to ask unless a safe policy explicitly allows auto-approval. Caps, risk checks, and most-restrictive-wins still apply before any future executor could run.');
    if (impact) impact.innerHTML = '<strong>No pause override detected:</strong> keep using simulation and manual approval until real policy persistence and executors are added in later approved phases.';
    const simPause = $('simMasterPauseActive');
    if (simPause) simPause.value = 'no';
  } else {
    banner.classList.add('unknown');
    setText('pauseOverrideStateBadge', 'STATUS UNKNOWN');
    setBadge(badge, 'paused');
    setText('pauseOverrideHeadline', 'Pause status is unavailable.');
    setText('pauseOverrideMessage', 'When pause status cannot be verified, LIFE.SAVER should behave conservatively: no auto-run, no executor activity, and manual review only.');
    if (impact) impact.innerHTML = '<strong>Safe fallback:</strong> unknown pause status should not allow auto-run. Treat automation as paused until status is confirmed.';
  }
  if (typeof updateSimulationPreview === 'function') updateSimulationPreview();
}
function readChecked(name){ return document.querySelector(`input[name="${name}"]:checked`)?.value || ''; }
function readNumber(id){ const raw = $(id)?.value; if(raw === undefined || raw === null || String(raw).trim() === '') return null; const numeric = Number(raw); return Number.isFinite(numeric) ? numeric : null; }
function readMultiSelect(id){ const el = $(id); if(!el || !el.options) return []; return Array.from(el.options).filter((option) => option.selected).map((option) => option.value); }
function updateAuthUi(){
  const user = safeJsonParse(localStorage.getItem(USER_KEY), null);
  const workspace = safeJsonParse(localStorage.getItem(WORKSPACE_KEY), null);
  setText('loggedInUser', user?.email || 'Not logged in');
  setText('loggedInWorkspace', workspace?.name || workspace?.id || 'No workspace loaded');
  setText('authState', getToken() ? 'AUTH STORED' : 'LOGIN NEEDED');
}
async function loadAutonomyStatus(){
  try{
    const response = await fetch(`${API_BASE}/api/v1/autonomy/status`, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
    if(!response.ok) throw new Error('Autonomy status unavailable');
    const payload = await response.json();
    const data = payload.data || payload;
    const status = data.status || data.autonomy || data;
    const categories = status.categories || {};
    const globalPaused = Boolean(status.pauseAllAutonomy ?? status.pause_all_autonomy ?? status.paused ?? false);
    const contentPaused = Boolean(categories.content?.paused ?? status.pauseContentActions ?? status.pause_content_actions);
    const supportPaused = Boolean(categories.support?.paused ?? status.pauseSupportActions ?? status.pause_support_actions);
    const adsPaused = Boolean(categories.ads?.paused ?? status.pauseAdsActions ?? status.pause_ads_actions);
    setText('globalPauseState', labelBool(globalPaused));
    setText('contentPauseState', labelBool(contentPaused));
    setText('supportPauseState', labelBool(supportPaused));
    setText('adsPauseState', labelBool(adsPaused));
    setText('masterPauseBadge', globalPaused ? 'PAUSED' : 'OPEN');
    setBadge($('masterPauseBadge'), globalPaused ? 'paused' : 'open');
    renderPauseIntegrationDisplay(globalPaused, contentPaused, supportPaused, adsPaused, 'loaded');
    setText('rulesState', globalPaused ? 'PAUSED OVERRIDE' : 'WIZARD READY');
  }catch(error){
    setText('masterPauseBadge', 'STATUS UNAVAILABLE');
    setBadge($('masterPauseBadge'), 'paused');
    setText('globalPauseState', '—');
    setText('contentPauseState', '—');
    setText('supportPauseState', '—');
    setText('adsPauseState', '—');
    renderPauseIntegrationDisplay(null, null, null, null, 'unavailable');
    setText('rulesState', 'SAFE FALLBACK');
  }
}
function buildCondition(){
  const field = $('conditionFieldSelect')?.value || 'risk_level';
  const operator = $('conditionOperatorSelect')?.value || 'equals';
  const rawValue = $('conditionValueInput')?.value || '';
  const numericOperators = SUPPORTED_CONDITION_OPERATORS.filter((operator) => ['less_than','greater_than','confidence_above','amount_below'].includes(operator));
  const value = numericOperators.includes(operator) && rawValue.trim() !== '' && Number.isFinite(Number(rawValue)) ? Number(rawValue) : rawValue.trim();
  return { field, operator, value };
}
function buildCaps(){
  const caps = {};
  const values = {
    max_posts_per_day: readNumber('capPostsPerDay'),
    max_support_auto_replies_per_day: readNumber('capSupportReplies'),
    max_ad_spend_change_per_day: readNumber('capAdSpendChange'),
    max_model_cost_per_day: readNumber('capModelCost'),
    max_actions_per_hour: readNumber('capActionsHour'),
  };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'number') caps[key] = value;
  }
  return caps;
}
function buildRulePreview(){
  const workspace = safeJsonParse(localStorage.getItem(WORKSPACE_KEY), null);
  const ruleName = ($('ruleNameInput')?.value || 'Untitled safe rule preview').trim();
  const actionType = readChecked('actionType') || 'content_publish';
  const platform = $('platformSelect')?.value || 'internal';
  const channel = $('channelSelect')?.value || 'internal_ops';
  const decision = readChecked('decision') || 'ask';
  const condition = buildCondition();
  const caps = buildCaps();
  return {
    version: '0.8.3',
    phase: 'Phase 7.9/7.10 Rule History/Audit retained',
    previewOnly: true,
    persistence: 'browser_local_preview_only_no_database_write',
    workspace_id: workspace?.id || 'current_workspace_from_session',
    name: ruleName,
    action_type: actionType,
    scope: { platform, channel },
    conditions_json: {
      match: 'all',
      conditions: [condition],
      scope: { platform, channel, action_type: actionType }
    },
    decision,
    caps_json: caps,
    priority: decision === 'block' ? 10 : decision === 'ask' ? 50 : 90,
    enabled: false,
    safety: {
      defaultAskPreserved: true,
      masterPauseStillOverrides: true,
      hardCapsStillOverride: true,
      mostRestrictiveWins: true,
      databaseWritesAttempted: false,
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      note: 'Phase 7.9 creates local policy previews, simulation previews, and pause override display only. A later approved phase must add authenticated policy creation, permission checks, and QA before database saves.'
    }
  };
}
function updatePreview(){
  const preview = buildRulePreview();
  setText('rulePreviewJson', JSON.stringify(preview, null, 2));
  return preview;
}
function showWizardStep(step){
  currentWizardStep = Math.min(Math.max(step, 1), TOTAL_WIZARD_STEPS);
  document.querySelectorAll('[data-step-panel]').forEach((panel) => {
    panel.classList.toggle('active', Number(panel.getAttribute('data-step-panel')) === currentWizardStep);
  });
  document.querySelectorAll('#ruleWizardStepper [data-step]').forEach((item) => {
    const number = Number(item.getAttribute('data-step'));
    item.classList.toggle('active', number === currentWizardStep);
    item.classList.toggle('complete', number < currentWizardStep);
  });
  setText('wizardStepStatus', `Step ${currentWizardStep} of ${TOTAL_WIZARD_STEPS}`);
  const prev = $('wizardPrevBtn');
  const next = $('wizardNextBtn');
  if (prev) prev.disabled = currentWizardStep === 1;
  if (next) next.textContent = currentWizardStep === TOTAL_WIZARD_STEPS ? 'Review again' : 'Next →';
  updatePreview();
}
async function copyRulePreview(){
  const text = JSON.stringify(updatePreview(), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('copyRulePreviewStatus');
    if (status) { status.textContent = 'Preview copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('copyRulePreviewStatus');
    if (status) { status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}
function saveRulePreview(){
  const preview = updatePreview();
  const saved = { ...preview, savedAt: new Date().toISOString() };
  localStorage.setItem(RULE_PREVIEW_KEY, JSON.stringify(saved));
  const status = $('saveRulePreviewStatus');
  if (status) { status.textContent = 'Local preview saved safely. No backend write.'; status.className = 'rules-inline-status ok'; }
  const box = $('localPreviewSavedBox');
  if (box) box.hidden = false;
  setText('rulesState', 'PREVIEW SAVED');
}
function resetRuleWizard(){
  $('ruleWizardForm')?.reset();
  localStorage.removeItem(RULE_PREVIEW_KEY);
  const box = $('localPreviewSavedBox');
  if (box) box.hidden = true;
  const status = $('saveRulePreviewStatus');
  if (status) { status.textContent = 'Not saved yet.'; status.className = 'rules-inline-status'; }
  showWizardStep(1);
}
function restoreSavedPreviewNote(){
  const saved = safeJsonParse(localStorage.getItem(RULE_PREVIEW_KEY), null);
  if (!saved) return;
  const status = $('saveRulePreviewStatus');
  if (status) { status.textContent = `Existing local preview saved at ${saved.savedAt || 'unknown time'}.`; status.className = 'rules-inline-status ok'; }
  const box = $('localPreviewSavedBox');
  if (box) box.hidden = false;
}

function buildContentRulePreview(){
  const workspace = safeJsonParse(localStorage.getItem(WORKSPACE_KEY), null);
  const platform = $('contentRulePlatform')?.value || 'instagram';
  const approvedStyle = ($('contentApprovedStyle')?.value || '').trim();
  const allowedContentType = $('contentAllowedContentType')?.value || 'image_post';
  const maxPostsPerDay = readNumber('contentMaxPostsDay');
  const autoPublishAllowed = ($('contentAutoPublishAllowed')?.value || 'no') === 'yes';
  const approvalRequiredAboveRiskLevel = $('contentApprovalRiskLevel')?.value || 'medium';
  return {
    version: '0.8.3',
    phase: 'Phase 7.9/7.10 Rule History/Audit retained',
    previewOnly: true,
    persistence: 'browser_local_preview_only_no_database_write',
    workspace_id: workspace?.id || 'current_workspace_from_session',
    name: `Content rule preview — ${platform}`,
    action_type: 'content_publish',
    scope: { platform, channel: 'organic_social', category: 'content' },
    content_rules: {
      platform,
      approved_style: approvedStyle,
      allowed_content_type: allowedContentType,
      max_posts_per_day: maxPostsPerDay,
      auto_publish_allowed: autoPublishAllowed,
      approval_required_above_risk_level: approvalRequiredAboveRiskLevel,
    },
    conditions_json: {
      match: 'all',
      scope: { action_type: 'content_publish', platform, channel: 'organic_social' },
      conditions: [
        { field: 'platform', operator: 'equals', value: platform },
        { field: 'payload.content_type', operator: 'equals', value: allowedContentType },
        { field: 'risk_level', operator: 'risk_below', value: approvalRequiredAboveRiskLevel }
      ],
      approved_style: approvedStyle,
    },
    decision: autoPublishAllowed ? 'auto_approve' : 'ask',
    caps_json: typeof maxPostsPerDay === 'number' ? { max_posts_per_day: maxPostsPerDay } : {},
    priority: autoPublishAllowed ? 80 : 50,
    enabled: false,
    safety: {
      localPreviewOnly: true,
      databaseWritesAttempted: false,
      policyEndpointCalled: false,
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      contentPublished: false,
      supportSent: false,
      adChanged: false,
      note: 'Phase 7.9 retains the content rules preview only. Auto-publish allowed is a future policy preference, not execution.'
    }
  };
}
function updateContentRulePreview(){
  const preview = buildContentRulePreview();
  setText('contentRulePreviewJson', JSON.stringify(preview, null, 2));
  return preview;
}
async function copyContentRulePreview(){
  const text = JSON.stringify(updateContentRulePreview(), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('contentRuleSaveStatus');
    if (status) { status.textContent = 'Content rule preview copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('contentRuleSaveStatus');
    if (status) { status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}
function saveContentRulePreview(){
  const saved = { ...updateContentRulePreview(), savedAt: new Date().toISOString() };
  localStorage.setItem(CONTENT_RULE_PREVIEW_KEY, JSON.stringify(saved));
  const status = $('contentRuleSaveStatus');
  if (status) { status.textContent = 'Local content preview saved safely. No backend write.'; status.className = 'rules-inline-status ok'; }
  setText('rulesState', 'CONTENT PREVIEW SAVED');
}
function resetContentRulePreview(){
  $('contentRulesForm')?.reset();
  localStorage.removeItem(CONTENT_RULE_PREVIEW_KEY);
  const status = $('contentRuleSaveStatus');
  if (status) { status.textContent = 'Not saved yet.'; status.className = 'rules-inline-status'; }
  updateContentRulePreview();
}
function restoreSavedContentPreviewNote(){
  const saved = safeJsonParse(localStorage.getItem(CONTENT_RULE_PREVIEW_KEY), null);
  if (!saved) return;
  const status = $('contentRuleSaveStatus');
  if (status) { status.textContent = `Existing local content preview saved at ${saved.savedAt || 'unknown time'}.`; status.className = 'rules-inline-status ok'; }
}


function buildSupportRulePreview(){
  const workspace = safeJsonParse(localStorage.getItem(WORKSPACE_KEY), null);
  const ticketCategory = $('supportTicketCategory')?.value || 'faq';
  const confidenceThreshold = readNumber('supportConfidenceThreshold');
  const autoReplyAllowed = ($('supportAutoReplyAllowed')?.value || 'no') === 'yes';
  const maxRepliesPerDay = readNumber('supportMaxRepliesDay');
  const approvalRequiredAboveRiskLevel = $('supportApprovalRiskLevel')?.value || 'medium';
  const escalationCategories = readMultiSelect('supportEscalationCategories');
  const sensitiveTicketExclusions = readMultiSelect('supportSensitiveTicketExclusions');
  const safeConfidenceThreshold = typeof confidenceThreshold === 'number' ? Math.min(Math.max(confidenceThreshold, 0), 1) : 0.9;
  return {
    version: '0.8.3',
    phase: 'Phase 7.9/7.10 Rule History/Audit retained',
    previewOnly: true,
    persistence: 'browser_local_preview_only_no_database_write',
    workspace_id: workspace?.id || 'current_workspace_from_session',
    name: `Support rule preview — ${ticketCategory}`,
    action_type: 'support_reply_send',
    scope: { platform: 'support_inbox', channel: 'support', category: ticketCategory },
    support_rules: {
      ticket_category: ticketCategory,
      confidence_threshold: safeConfidenceThreshold,
      auto_reply_allowed: autoReplyAllowed,
      escalation_categories: escalationCategories,
      max_replies_per_day: maxRepliesPerDay,
      sensitive_ticket_exclusions: sensitiveTicketExclusions,
      approval_required_above_risk_level: approvalRequiredAboveRiskLevel,
    },
    conditions_json: {
      match: 'all',
      scope: { action_type: 'support_reply_send', channel: 'support', category: ticketCategory },
      conditions: [
        { field: 'category', operator: 'equals', value: ticketCategory },
        { field: 'confidence_score', operator: 'confidence_above', value: safeConfidenceThreshold },
        { field: 'risk_level', operator: 'risk_below', value: approvalRequiredAboveRiskLevel }
      ],
      escalation_categories: escalationCategories,
      sensitive_ticket_exclusions: sensitiveTicketExclusions,
    },
    decision: autoReplyAllowed ? 'auto_approve' : 'ask',
    caps_json: typeof maxRepliesPerDay === 'number' ? { max_support_auto_replies_per_day: maxRepliesPerDay } : {},
    priority: autoReplyAllowed ? 75 : 45,
    enabled: false,
    safety: {
      localPreviewOnly: true,
      databaseWritesAttempted: false,
      policyEndpointCalled: false,
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      supportSent: false,
      emailSent: false,
      helpdeskUpdated: false,
      contentPublished: false,
      adChanged: false,
      sensitiveTicketsEscalate: true,
      note: 'Phase 7.6 retains support rules preview only. Auto-reply allowed is a future policy preference, not support sending.'
    }
  };
}
function updateSupportRulePreview(){
  const preview = buildSupportRulePreview();
  setText('supportRulePreviewJson', JSON.stringify(preview, null, 2));
  return preview;
}
async function copySupportRulePreview(){
  const text = JSON.stringify(updateSupportRulePreview(), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('supportRuleSaveStatus');
    if (status) { status.textContent = 'Support rule preview copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('supportRuleSaveStatus');
    if (status) { status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}
function saveSupportRulePreview(){
  const saved = { ...updateSupportRulePreview(), savedAt: new Date().toISOString() };
  localStorage.setItem(SUPPORT_RULE_PREVIEW_KEY, JSON.stringify(saved));
  const status = $('supportRuleSaveStatus');
  if (status) { status.textContent = 'Local support preview saved safely. No backend write.'; status.className = 'rules-inline-status ok'; }
  setText('rulesState', 'SUPPORT PREVIEW SAVED');
}
function resetSupportRulePreview(){
  $('supportRulesForm')?.reset();
  localStorage.removeItem(SUPPORT_RULE_PREVIEW_KEY);
  const status = $('supportRuleSaveStatus');
  if (status) { status.textContent = 'Not saved yet.'; status.className = 'rules-inline-status'; }
  updateSupportRulePreview();
}
function restoreSavedSupportPreviewNote(){
  const saved = safeJsonParse(localStorage.getItem(SUPPORT_RULE_PREVIEW_KEY), null);
  if (!saved) return;
  const status = $('supportRuleSaveStatus');
  if (status) { status.textContent = `Existing local support preview saved at ${saved.savedAt || 'unknown time'}.`; status.className = 'rules-inline-status ok'; }
}


function buildAdsRulePreview(){
  const workspace = safeJsonParse(localStorage.getItem(WORKSPACE_KEY), null);
  const platform = $('adsRulePlatform')?.value || 'meta_ads';
  const campaignScope = $('adsCampaignScope')?.value || 'single_campaign';
  const maxDailyBudgetChange = readNumber('adsMaxDailyBudgetChange');
  const maxPercentageChange = readNumber('adsMaxPercentageChange');
  const alwaysAskAboveThreshold = readNumber('adsAlwaysAskAboveThreshold');
  const pauseRules = readMultiSelect('adsPauseRules');
  const approvalRequiredAboveRiskLevel = $('adsApprovalRiskLevel')?.value || 'medium';
  const safeMaxPercentageChange = typeof maxPercentageChange === 'number' ? Math.min(Math.max(maxPercentageChange, 0), 100) : null;
  return {
    version: '0.8.3',
    phase: 'Phase 7.9/7.10 Rule History/Audit retained',
    previewOnly: true,
    persistence: 'browser_local_preview_only_no_database_write',
    workspace_id: workspace?.id || 'current_workspace_from_session',
    name: `Ads rule preview — ${platform}`,
    action_type: 'ad_budget_adjust',
    scope: { platform, channel: 'paid_media', category: 'ads', campaign_scope: campaignScope },
    ads_rules: {
      platform,
      campaign_scope: campaignScope,
      max_daily_budget_change: maxDailyBudgetChange,
      max_percentage_change: safeMaxPercentageChange,
      always_ask_above_threshold: alwaysAskAboveThreshold,
      pause_rules: pauseRules,
      approval_required_above_risk_level: approvalRequiredAboveRiskLevel,
    },
    conditions_json: {
      match: 'all',
      scope: { action_type: 'ad_budget_adjust', platform, channel: 'paid_media', category: 'ads' },
      conditions: [
        { field: 'platform', operator: 'equals', value: platform },
        { field: 'category', operator: 'equals', value: 'ads' },
        { field: 'risk_level', operator: 'risk_below', value: approvalRequiredAboveRiskLevel },
        ...(typeof alwaysAskAboveThreshold === 'number' ? [{ field: 'amount', operator: 'amount_below', value: alwaysAskAboveThreshold }] : [])
      ],
      pause_rules: pauseRules,
      campaign_scope: campaignScope,
    },
    decision: 'ask',
    caps_json: {
      ...(typeof maxDailyBudgetChange === 'number' ? { max_ad_spend_change_per_day: maxDailyBudgetChange } : {}),
      ...(typeof safeMaxPercentageChange === 'number' ? { max_ad_spend_percentage_change_per_action_preview: safeMaxPercentageChange } : {}),
    },
    priority: 35,
    enabled: false,
    safety: {
      localPreviewOnly: true,
      databaseWritesAttempted: false,
      policyEndpointCalled: false,
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      adConnectorAdded: false,
      adBudgetChanged: false,
      campaignPaused: false,
      adSetPaused: false,
      contentPublished: false,
      supportSent: false,
      moneyImpactingActionsRemainManual: true,
      note: 'Phase 7.9 retains ads rules preview only. Budget and pause settings remain future policy preferences, not ad execution.'
    }
  };
}
function updateAdsRulePreview(){
  const preview = buildAdsRulePreview();
  setText('adsRulePreviewJson', JSON.stringify(preview, null, 2));
  return preview;
}
async function copyAdsRulePreview(){
  const text = JSON.stringify(updateAdsRulePreview(), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('adsRuleSaveStatus');
    if (status) { status.textContent = 'Ads rule preview copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('adsRuleSaveStatus');
    if (status) { status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}
function saveAdsRulePreview(){
  const saved = { ...updateAdsRulePreview(), savedAt: new Date().toISOString() };
  localStorage.setItem(ADS_RULE_PREVIEW_KEY, JSON.stringify(saved));
  const status = $('adsRuleSaveStatus');
  if (status) { status.textContent = 'Local ads preview saved safely. No backend write.'; status.className = 'rules-inline-status ok'; }
  setText('rulesState', 'ADS PREVIEW SAVED');
}
function resetAdsRulePreview(){
  $('adsRulesForm')?.reset();
  localStorage.removeItem(ADS_RULE_PREVIEW_KEY);
  const status = $('adsRuleSaveStatus');
  if (status) { status.textContent = 'Not saved yet.'; status.className = 'rules-inline-status'; }
  updateAdsRulePreview();
}
function restoreSavedAdsPreviewNote(){
  const saved = safeJsonParse(localStorage.getItem(ADS_RULE_PREVIEW_KEY), null);
  if (!saved) return;
  const status = $('adsRuleSaveStatus');
  if (status) { status.textContent = `Existing local ads preview saved at ${saved.savedAt || 'unknown time'}.`; status.className = 'rules-inline-status ok'; }
}

function buildCapsSettingsPreview(){
  const workspace = safeJsonParse(localStorage.getItem(WORKSPACE_KEY), null);
  const postsPerDay = readNumber('capsPostsPerDay');
  const autoRepliesPerDay = readNumber('capsAutoRepliesPerDay');
  const adBudgetChangePerDay = readNumber('capsAdBudgetChangePerDay');
  const modelTokensPerDay = readNumber('capsModelTokensPerDay');
  const modelCostPerDay = readNumber('capsModelCostPerDay');
  const actionsPerHour = readNumber('capsActionsPerHour');
  return {
    version: '0.8.3',
    phase: 'Phase 7.9/7.10 Rule History/Audit retained',
    previewOnly: true,
    persistence: 'browser_local_preview_only_no_database_write',
    workspace_id: workspace?.id || 'current_workspace_from_session',
    name: 'Global caps settings preview',
    caps_json: {
      ...(typeof postsPerDay === 'number' ? { max_posts_per_day: postsPerDay } : {}),
      ...(typeof autoRepliesPerDay === 'number' ? { max_support_auto_replies_per_day: autoRepliesPerDay } : {}),
      ...(typeof adBudgetChangePerDay === 'number' ? { max_ad_spend_change_per_day: adBudgetChangePerDay } : {}),
      ...(typeof modelTokensPerDay === 'number' ? { max_model_tokens_per_day: modelTokensPerDay } : {}),
      ...(typeof modelCostPerDay === 'number' ? { max_model_cost_per_day: modelCostPerDay } : {}),
      ...(typeof actionsPerHour === 'number' ? { max_actions_per_hour: actionsPerHour } : {}),
    },
    cap_ui_fields: {
      posts_per_day: postsPerDay,
      auto_replies_per_day: autoRepliesPerDay,
      ad_budget_change_per_day: adBudgetChangePerDay,
      model_tokens_per_day: modelTokensPerDay,
      model_cost_per_day: modelCostPerDay,
      actions_per_hour: actionsPerHour,
    },
    safety: {
      localPreviewOnly: true,
      databaseWritesAttempted: false,
      policyEndpointCalled: false,
      capDatabaseSaveAttempted: false,
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      contentPublished: false,
      supportSent: false,
      adBudgetChanged: false,
      campaignPaused: false,
      note: 'Phase 7.9 previews global cap settings only. The values are not persisted to the database and do not enable auto-run or execution.'
    }
  };
}
function updateCapsPreview(){
  const preview = buildCapsSettingsPreview();
  setText('capsPreviewJson', JSON.stringify(preview, null, 2));
  return preview;
}
async function copyCapsPreview(){
  const text = JSON.stringify(updateCapsPreview(), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('capsSaveStatus');
    if (status) { status.textContent = 'Caps preview copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('capsSaveStatus');
    if (status) { status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}
function saveCapsPreview(){
  const saved = { ...updateCapsPreview(), savedAt: new Date().toISOString() };
  localStorage.setItem(CAPS_PREVIEW_KEY, JSON.stringify(saved));
  const status = $('capsSaveStatus');
  if (status) { status.textContent = 'Local caps preview saved safely. No backend write.'; status.className = 'rules-inline-status ok'; }
  setText('rulesState', 'CAPS PREVIEW SAVED');
}
function resetCapsPreview(){
  $('capsSettingsForm')?.reset();
  localStorage.removeItem(CAPS_PREVIEW_KEY);
  const status = $('capsSaveStatus');
  if (status) { status.textContent = 'Not saved yet.'; status.className = 'rules-inline-status'; }
  updateCapsPreview();
}
function restoreSavedCapsPreviewNote(){
  const saved = safeJsonParse(localStorage.getItem(CAPS_PREVIEW_KEY), null);
  if (!saved) return;
  const status = $('capsSaveStatus');
  if (status) { status.textContent = `Existing local caps preview saved at ${saved.savedAt || 'unknown time'}.`; status.className = 'rules-inline-status ok'; }
}


const RISK_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
function riskRank(value){ return RISK_RANK[value] || 0; }
function humanize(value){ return String(value || '').replace(/_/g, ' '); }
function getStoredPreview(key, fallbackBuilder){
  const stored = safeJsonParse(localStorage.getItem(key), null);
  return stored || fallbackBuilder();
}
function getSimulationRulePreview(source){
  if(source === 'content') return getStoredPreview(CONTENT_RULE_PREVIEW_KEY, buildContentRulePreview);
  if(source === 'support') return getStoredPreview(SUPPORT_RULE_PREVIEW_KEY, buildSupportRulePreview);
  if(source === 'ads') return getStoredPreview(ADS_RULE_PREVIEW_KEY, buildAdsRulePreview);
  if(source === 'caps') return getStoredPreview(CAPS_PREVIEW_KEY, buildCapsSettingsPreview);
  return getStoredPreview(RULE_PREVIEW_KEY, buildRulePreview);
}
function buildSimulationInput(){
  return {
    rule_source: $('simRuleSource')?.value || 'content',
    action_type: $('simActionType')?.value || 'content_publish',
    platform: $('simPlatform')?.value || 'instagram',
    channel: $('simChannel')?.value || 'organic_social',
    category: $('simCategory')?.value || 'content',
    risk_level: $('simRiskLevel')?.value || 'medium',
    confidence_score: readNumber('simConfidenceScore'),
    amount: readNumber('simAmount'),
    master_pause_active: ($('simMasterPauseActive')?.value || 'no') === 'yes',
    live_pause_display_status: lastPauseIntegrationState,
    text_preview: ($('simActionText')?.value || '').trim(),
  };
}
function simulateRuleDecision(){
  const input = buildSimulationInput();
  const rule = getSimulationRulePreview(input.rule_source);
  const caps = rule?.caps_json || rule?.caps || {};
  const reasons = [];
  let decision = rule?.decision || 'ask';
  let matched = true;

  if(input.master_pause_active){
    decision = 'block';
    matched = false;
    reasons.push('Master pause is active, so future autonomy must remain blocked.');
  }

  if(!input.master_pause_active){
    const scope = rule?.scope || rule?.conditions_json?.scope || {};
    if(scope.action_type && scope.action_type !== input.action_type){ matched = false; reasons.push(`Action type does not match rule scope (${scope.action_type}).`); }
    if(scope.platform && scope.platform !== input.platform && scope.platform !== 'internal_preview'){ matched = false; reasons.push(`Platform does not match rule scope (${scope.platform}).`); }
    if(scope.channel && scope.channel !== input.channel){ matched = false; reasons.push(`Channel does not match rule scope (${scope.channel}).`); }
    if(input.rule_source === 'caps') { decision = 'ask'; reasons.push('Caps preview alone cannot auto-approve an action; it only limits future decisions.'); }
    if(!matched && decision !== 'block') decision = 'ask';
  }

  if(!input.master_pause_active){
    if(input.risk_level === 'critical') { decision = 'block'; reasons.push('Critical risk is blocked in the safe preview.'); }
    else if(input.risk_level === 'high' && decision === 'auto_approve') { decision = 'ask'; reasons.push('High risk downgrades auto-approval to manual review.'); }

    if(input.rule_source === 'content'){
      const contentRules = rule?.content_rules || {};
      const threshold = contentRules.approval_required_above_risk_level || 'medium';
      if(riskRank(input.risk_level) > riskRank(threshold)) { decision = 'ask'; reasons.push(`Content risk is above the approval threshold (${threshold}).`); }
      if(!contentRules.auto_publish_allowed) { decision = 'ask'; reasons.push('Content auto-publish is not allowed in the preview rule.'); }
      if(contentRules.auto_publish_allowed && decision !== 'block' && riskRank(input.risk_level) <= riskRank(threshold)) { decision = matched ? 'auto_approve' : 'ask'; }
    }

    if(input.rule_source === 'support'){
      const supportRules = rule?.support_rules || {};
      const threshold = typeof supportRules.confidence_threshold === 'number' ? supportRules.confidence_threshold : 0.9;
      const escalation = supportRules.escalation_categories || [];
      const sensitive = supportRules.sensitive_ticket_exclusions || [];
      if(typeof input.confidence_score === 'number' && input.confidence_score < threshold) { decision = 'ask'; reasons.push(`Confidence is below threshold (${threshold}).`); }
      if(escalation.includes(input.category) || sensitive.includes(input.category) || input.category === 'sensitive') { decision = 'ask'; reasons.push('Ticket category is escalation/sensitive and requires human review.'); }
      if(!supportRules.auto_reply_allowed) { decision = 'ask'; reasons.push('Support auto-reply is not allowed in the preview rule.'); }
      if(supportRules.auto_reply_allowed && matched && decision !== 'block' && (typeof input.confidence_score !== 'number' || input.confidence_score >= threshold) && !escalation.includes(input.category) && !sensitive.includes(input.category)) { decision = 'auto_approve'; }
    }

    if(input.rule_source === 'ads'){
      const adsRules = rule?.ads_rules || {};
      const askAbove = typeof adsRules.always_ask_above_threshold === 'number' ? adsRules.always_ask_above_threshold : 0;
      if(typeof input.amount === 'number' && askAbove > 0 && input.amount > askAbove) { decision = 'ask'; reasons.push(`Amount is above always-ask threshold (${askAbove}).`); }
      decision = decision === 'block' ? 'block' : 'ask';
      reasons.push('Ads changes are money-impacting and remain ask/manual review in this phase.');
    }

    if(typeof input.amount === 'number'){
      if(typeof caps.max_ad_spend_change_per_day === 'number' && input.action_type.includes('ad') && input.amount > caps.max_ad_spend_change_per_day){ decision = 'block'; reasons.push('Amount exceeds max_ad_spend_change_per_day cap.'); }
      if(typeof caps.max_model_cost_per_day === 'number' && input.category === 'research' && input.amount > caps.max_model_cost_per_day){ decision = 'block'; reasons.push('Amount exceeds max_model_cost_per_day cap preview.'); }
    }
  }

  if(reasons.length === 0){
    reasons.push(decision === 'auto_approve' ? 'Rule scope and safety thresholds match the proposed action.' : 'Default ask/manual review remains the safe decision.');
  }

  return {
    version: '0.8.3',
    phase: 'Phase 7.9/7.10 Rule History/Audit retained',
    previewOnly: true,
    persistence: 'browser_local_simulation_only_no_database_write',
    input,
    rule_preview_used: rule,
    simulation_result: {
      decision,
      label: decision === 'auto_approve' ? 'AUTO-APPROVED' : decision === 'block' ? 'BLOCKED' : 'ASK',
      matched,
      reasons,
      sentence: `This proposed ${humanize(input.platform)} ${humanize(input.action_type)} would be: ${decision === 'auto_approve' ? 'auto-approved' : decision === 'block' ? 'blocked' : 'ask/manual review'}.`,
    },
    safety: {
      localPreviewOnly: true,
      databaseWritesAttempted: false,
      policyEndpointCalled: false,
      simulationDatabaseSaveAttempted: false,
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      contentPublished: false,
      supportSent: false,
      adBudgetChanged: false,
      campaignPaused: false,
      note: 'Phase 7.9 simulates policy outcomes, displays pause override status, and feeds local policy audit preview only. It does not enable rules, run executors, write audit rows, or write to external platforms.'
    }
  };
}
function updateSimulationPreview(){
  const preview = simulateRuleDecision();
  const result = preview.simulation_result;
  const badge = $('simulationDecisionBadge');
  setText('simulationDecisionSentence', result.sentence);
  setText('simulationDecisionBadge', result.label);
  setText('simulationReasonText', result.reasons.join(' '));
  if(badge){
    badge.className = 'rules-decision-badge ' + (result.decision === 'auto_approve' ? 'auto' : result.decision === 'block' ? 'block' : 'ask');
  }
  setText('simulationPreviewJson', JSON.stringify(preview, null, 2));
  return preview;
}
async function copySimulationPreview(){
  const text = JSON.stringify(updateSimulationPreview(), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('simulationSaveStatus');
    if (status) { status.textContent = 'Simulation preview copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('simulationSaveStatus');
    if (status) { status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}
function saveSimulationPreview(){
  const saved = { ...updateSimulationPreview(), savedAt: new Date().toISOString() };
  localStorage.setItem(SIMULATION_PREVIEW_KEY, JSON.stringify(saved));
  const status = $('simulationSaveStatus');
  if (status) { status.textContent = 'Local simulation preview saved safely. No backend write.'; status.className = 'rules-inline-status ok'; }
  setText('rulesState', 'SIMULATION SAVED');
}
function resetSimulationPreview(){
  $('ruleSimulationForm')?.reset();
  localStorage.removeItem(SIMULATION_PREVIEW_KEY);
  const status = $('simulationSaveStatus');
  if (status) { status.textContent = 'Not saved yet.'; status.className = 'rules-inline-status'; }
  updateSimulationPreview();
}
function restoreSavedSimulationPreviewNote(){
  const saved = safeJsonParse(localStorage.getItem(SIMULATION_PREVIEW_KEY), null);
  if (!saved) return;
  const status = $('simulationSaveStatus');
  if (status) { status.textContent = `Existing local simulation preview saved at ${saved.savedAt || 'unknown time'}.`; status.className = 'rules-inline-status ok'; }
}


function getActorLabel(){
  const user = safeJsonParse(localStorage.getItem(USER_KEY), null);
  return user?.email || user?.name || 'Current founder / local session';
}
function formatAuditTime(value){
  if(!value) return 'Not recorded';
  try { return new Date(value).toLocaleString(); } catch { return String(value); }
}
function decisionFromPreview(preview){
  if(!preview) return 'No recent decision';
  const result = preview.simulation_result || {};
  if(result.label) return result.label;
  if(preview.decision) return String(preview.decision).toUpperCase();
  if(preview.enabled === false) return 'DISABLED / NOT ENABLED';
  return 'LOCAL PREVIEW';
}
function collectPolicyAuditRecords(){
  const actor = getActorLabel();
  const savedSimulation = safeJsonParse(localStorage.getItem(SIMULATION_PREVIEW_KEY), null);
  const previewSources = [
    { label: 'Create Rule Wizard Preview', key: RULE_PREVIEW_KEY, builder: buildRulePreview },
    { label: 'Content Rules Preview', key: CONTENT_RULE_PREVIEW_KEY, builder: buildContentRulePreview },
    { label: 'Support Rules Preview', key: SUPPORT_RULE_PREVIEW_KEY, builder: buildSupportRulePreview },
    { label: 'Ads Rules Preview', key: ADS_RULE_PREVIEW_KEY, builder: buildAdsRulePreview },
    { label: 'Global Caps Preview', key: CAPS_PREVIEW_KEY, builder: buildCapsSettingsPreview },
    { label: 'Rule Simulation Preview', key: SIMULATION_PREVIEW_KEY, builder: updateSimulationPreview },
  ];
  return previewSources.map((source, index) => {
    const saved = safeJsonParse(localStorage.getItem(source.key), null);
    const fallback = source.builder ? source.builder() : null;
    const preview = saved || fallback || {};
    const savedAt = saved?.savedAt || preview?.savedAt || null;
    const createdAt = preview?.created_at || savedAt || null;
    const updatedAt = preview?.updated_at || savedAt || null;
    const enabled = preview?.enabled === true;
    const disabledBy = enabled ? 'Not disabled' : actor;
    const lastTriggered = source.key === SIMULATION_PREVIEW_KEY
      ? (savedAt || new Date().toISOString())
      : (savedSimulation?.savedAt || null);
    const recentDecision = source.key === SIMULATION_PREVIEW_KEY
      ? decisionFromPreview(preview)
      : (savedSimulation?.simulation_result?.label || decisionFromPreview(preview));
    return {
      id: `local-audit-${index + 1}`,
      rule_preview: source.label,
      created_by: preview?.created_by || actor,
      updated_by: preview?.updated_by || (savedAt ? actor : 'Not updated yet'),
      disabled_by: preview?.disabled_by || disabledBy,
      last_triggered: lastTriggered ? formatAuditTime(lastTriggered) : 'Never triggered',
      recent_decisions: [recentDecision],
      source: 'browser_local_preview_only',
      saved: Boolean(saved),
      enabled,
    };
  });
}
function buildPolicyAuditPreview(){
  const records = collectPolicyAuditRecords();
  const recentDecisionCount = records.reduce((total, record) => total + (record.recent_decisions?.length || 0), 0);
  const savedRecords = records.filter((record) => record.saved).length;
  const firstRecord = records[0] || {};
  const lastTriggeredRecord = records.find((record) => record.last_triggered && record.last_triggered !== 'Never triggered') || null;
  return {
    version: '0.8.3',
    phase: 'Phase 7.9/7.10 Rule History/Audit retained',
    previewOnly: true,
    persistence: 'browser_local_audit_preview_only_no_database_write',
    audit_summary: {
      created_by: firstRecord.created_by || getActorLabel(),
      updated_by: records.find((record) => record.updated_by !== 'Not updated yet')?.updated_by || 'Not updated yet',
      disabled_by: records.find((record) => record.disabled_by && record.disabled_by !== 'Not disabled')?.disabled_by || 'Not disabled',
      last_triggered: lastTriggeredRecord?.last_triggered || 'Never triggered',
      recent_decision_count: recentDecisionCount,
      saved_local_preview_count: savedRecords,
    },
    records,
    required_fields_shown: ['created_by','updated_by','disabled_by','last_triggered','recent_decisions'],
    safety: {
      localPreviewOnly: true,
      databaseAuditQueryAttempted: false,
      databaseAuditWriteAttempted: false,
      policyEndpointCalled: false,
      policyDatabaseWrites: false,
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      note: 'Phase 7.9 renders Policy Audit UI using local previews only. A later approved phase can connect this to real policy audit records after permission checks and database contracts are added.'
    }
  };
}
function renderPolicyAuditTable(preview){
  const body = $('policyAuditTableBody');
  if(!body) return;
  body.innerHTML = preview.records.map((record) => `
    <tr>
      <td><strong>${record.rule_preview}</strong><small>${record.saved ? 'Saved locally' : 'Generated preview'}</small></td>
      <td>${record.created_by}</td>
      <td>${record.updated_by}</td>
      <td>${record.disabled_by}</td>
      <td>${record.last_triggered}</td>
      <td>${record.recent_decisions.map((decision) => `<span class="audit-decision-pill">${decision}</span>`).join(' ')}</td>
    </tr>
  `).join('');
}
function updatePolicyAuditPreview(){
  const preview = buildPolicyAuditPreview();
  setText('auditCreatedBy', preview.audit_summary.created_by);
  setText('auditUpdatedBy', preview.audit_summary.updated_by);
  setText('auditDisabledBy', preview.audit_summary.disabled_by);
  setText('auditLastTriggered', preview.audit_summary.last_triggered);
  setText('auditRecentDecisionCount', String(preview.audit_summary.recent_decision_count));
  setText('policyAuditPreviewJson', JSON.stringify(preview, null, 2));
  renderPolicyAuditTable(preview);
  setText('policyAuditStatusBadge', preview.audit_summary.saved_local_preview_count > 0 ? 'LOCAL SAVED' : 'LOCAL PREVIEW');
  return preview;
}
async function copyPolicyAuditPreview(){
  const text = JSON.stringify(updatePolicyAuditPreview(), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('policyAuditSaveStatus');
    if (status) { status.textContent = 'Policy audit preview copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('policyAuditSaveStatus');
    if (status) { status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}
function savePolicyAuditPreview(){
  const saved = { ...updatePolicyAuditPreview(), savedAt: new Date().toISOString() };
  localStorage.setItem(POLICY_AUDIT_PREVIEW_KEY, JSON.stringify(saved));
  const status = $('policyAuditSaveStatus');
  if (status) { status.textContent = 'Local audit snapshot saved safely. No backend write.'; status.className = 'rules-inline-status ok'; }
  setText('rulesState', 'AUDIT SAVED');
}
function resetPolicyAuditPreview(){
  localStorage.removeItem(POLICY_AUDIT_PREVIEW_KEY);
  const status = $('policyAuditSaveStatus');
  if (status) { status.textContent = 'Not saved yet.'; status.className = 'rules-inline-status'; }
  updatePolicyAuditPreview();
}
function restoreSavedPolicyAuditNote(){
  const saved = safeJsonParse(localStorage.getItem(POLICY_AUDIT_PREVIEW_KEY), null);
  if (!saved) return;
  const status = $('policyAuditSaveStatus');
  if (status) { status.textContent = `Existing local audit snapshot saved at ${saved.savedAt || 'unknown time'}.`; status.className = 'rules-inline-status ok'; }
}


function normalizeRulesRole(role){
  const normalized = String(role || '').trim().toLowerCase();
  if(['owner','admin','member','viewer'].includes(normalized)) return normalized;
  return 'unauthorized';
}
function getDetectedRulesRole(){
  const user = safeJsonParse(localStorage.getItem(USER_KEY), null) || {};
  const workspace = safeJsonParse(localStorage.getItem(WORKSPACE_KEY), null) || {};
  return normalizeRulesRole(
    user.workspaceRole || user.workspace_role || user.membershipRole || user.membership_role ||
    workspace.workspaceRole || workspace.role || workspace.currentUserRole || user.role ||
    'owner'
  );
}
function canEditRulesForRole(role, adminEditAllowed, authorizedRequest = true){
  const normalizedRole = normalizeRulesRole(role);
  if(!authorizedRequest || normalizedRole === 'unauthorized') {
    return { allowed: false, code: 'UNAUTHORIZED_REQUEST_BLOCKED', reason: 'Unauthorized or cross-workspace requests must be blocked before any future policy editing endpoint runs.' };
  }
  if(normalizedRole === 'owner') {
    return { allowed: true, code: 'OWNER_CAN_EDIT', reason: 'Owner can edit rule previews and future policy settings.' };
  }
  if(normalizedRole === 'admin') {
    return adminEditAllowed
      ? { allowed: true, code: 'ADMIN_CAN_EDIT_IF_ALLOWED', reason: 'Admin can edit only when workspace/admin policy allows rule editing.' }
      : { allowed: false, code: 'ADMIN_EDIT_NOT_ALLOWED', reason: 'Admin is authenticated but rule editing is not allowed for this workspace setting.' };
  }
  if(normalizedRole === 'viewer') {
    return { allowed: false, code: 'VIEWER_CANNOT_EDIT', reason: 'Viewer can inspect rules but cannot edit or save rule previews.' };
  }
  return { allowed: false, code: 'ROLE_CANNOT_EDIT', reason: 'Only owner, or admin when allowed, may edit rules.' };
}
function getPermissionQaSelections(){
  const role = $('rulesPermissionRoleSelect')?.value || getDetectedRulesRole();
  const adminEditAllowed = ($('rulesPermissionAdminAllowedSelect')?.value || 'yes') === 'yes';
  const authMode = $('rulesPermissionAuthSelect')?.value || 'authorized';
  return {
    role: normalizeRulesRole(role),
    adminEditAllowed,
    authMode,
    authorizedRequest: authMode === 'authorized',
  };
}
function buildRulesPermissionQaPreview(){
  const selected = getPermissionQaSelections();
  const detectedRole = getDetectedRulesRole();
  const scenarioInputs = [
    { scenario: 'Owner can edit', role: 'owner', adminEditAllowed: selected.adminEditAllowed, authorizedRequest: true },
    { scenario: 'Admin can edit if allowed', role: 'admin', adminEditAllowed: true, authorizedRequest: true },
    { scenario: 'Admin blocked when not allowed', role: 'admin', adminEditAllowed: false, authorizedRequest: true },
    { scenario: 'Viewer cannot edit', role: 'viewer', adminEditAllowed: selected.adminEditAllowed, authorizedRequest: true },
    { scenario: 'Unauthorized request blocked', role: 'unauthorized', adminEditAllowed: selected.adminEditAllowed, authorizedRequest: false },
  ];
  const scenarios = scenarioInputs.map((item) => ({
    ...item,
    ...canEditRulesForRole(item.role, item.adminEditAllowed, item.authorizedRequest),
    expected_result: canEditRulesForRole(item.role, item.adminEditAllowed, item.authorizedRequest).allowed ? 'ALLOW_EDIT' : 'BLOCK_EDIT',
  }));
  const currentDecision = canEditRulesForRole(selected.role, selected.adminEditAllowed, selected.authorizedRequest);
  return {
    version: '0.8.3',
    phase: 'Phase 7.10 Rules Permission QA',
    previewOnly: true,
    persistence: 'browser_local_permission_qa_only_no_database_write',
    detectedRole,
    selectedRole: selected.role,
    adminEditAllowed: selected.adminEditAllowed,
    authMode: selected.authMode,
    currentDecision,
    required_tests: {
      owner_can_edit: scenarios.find((scenario) => scenario.scenario === 'Owner can edit')?.allowed === true,
      admin_can_edit_if_allowed: scenarios.find((scenario) => scenario.scenario === 'Admin can edit if allowed')?.allowed === true,
      viewer_cannot_edit: scenarios.find((scenario) => scenario.scenario === 'Viewer cannot edit')?.allowed === false,
      unauthorized_request_blocked: scenarios.find((scenario) => scenario.scenario === 'Unauthorized request blocked')?.allowed === false,
    },
    scenarios,
    ui_gate: {
      localSaveButtonsDisabledForCurrentSelection: !currentDecision.allowed,
      controlledButtonIds: ['saveRulePreviewBtn','saveContentRulePreviewBtn','saveSupportRulePreviewBtn','saveAdsRulePreviewBtn','saveCapsPreviewBtn','saveSimulationPreviewBtn','savePolicyAuditBtn'],
      backendPolicyEndpointCalled: false,
      policyDatabaseWrites: false,
      permissionDatabaseWrites: false,
    },
    safety: {
      localPreviewOnly: true,
      policyEditingEndpoints: false,
      policyDatabaseWrites: false,
      permissionDatabaseWrites: false,
      realExecutors: false,
      sandboxExecutors: false,
      externalWriteConnectors: false,
      autoRunExecution: false,
      contentPublishing: false,
      supportSending: false,
      adBudgetChanges: false,
      campaignPauses: false,
      externalWrites: false,
    }
  };
}
function renderRulesPermissionQaTable(preview){
  const body = $('rulesPermissionQaTableBody');
  if(!body) return;
  body.innerHTML = preview.scenarios.map((scenario) => `
    <tr>
      <td><strong>${scenario.scenario}</strong><small>${scenario.code}</small></td>
      <td>${scenario.role}</td>
      <td>${scenario.adminEditAllowed ? 'Yes' : 'No'}</td>
      <td>${scenario.authorizedRequest ? 'Yes' : 'No'}</td>
      <td><span class="audit-decision-pill ${scenario.allowed ? 'permission-allow' : 'permission-block'}">${scenario.expected_result}</span></td>
      <td>${scenario.reason}</td>
    </tr>
  `).join('');
}
function applyRulesPermissionGate(preview){
  const current = preview || buildRulesPermissionQaPreview();
  const allowed = Boolean(current.currentDecision?.allowed);
  const badge = $('rulesPermissionStatusBadge');
  setText('rulesPermissionStatusBadge', allowed ? 'EDIT ALLOWED' : 'EDIT BLOCKED');
  setBadge(badge, allowed ? 'open' : 'blocked');
  const banner = $('rulesPermissionGateBanner');
  if(banner){
    banner.classList.remove('permission-allowed','permission-blocked');
    banner.classList.add(allowed ? 'permission-allowed' : 'permission-blocked');
  }
  setText('rulesPermissionHeadline', allowed ? 'Current role can edit local rule previews.' : 'Current role cannot edit rules.');
  setText('rulesPermissionMessage', current.currentDecision?.reason || 'Rules permission status unavailable.');
  const scopeList = $('rulesPermissionScopeList');
  if(scopeList) scopeList.innerHTML = [
    'Owner: can edit',
    `Admin: ${current.adminEditAllowed ? 'can edit if allowed' : 'blocked by workspace setting'}`,
    'Viewer: cannot edit',
    current.authMode === 'authorized' ? 'Request: authorized' : 'Request: unauthorized / blocked',
  ].map((item) => `<li>${item}</li>`).join('');
  current.ui_gate.controlledButtonIds.forEach((id) => {
    const button = $(id);
    if(!button) return;
    button.disabled = !allowed;
    button.setAttribute('data-rule-edit-control', 'true');
    button.setAttribute('title', allowed ? 'Rule preview editing allowed for this role.' : 'Rule editing blocked by Phase 7.10 permission QA.');
  });
  setText('rulesState', allowed ? 'RULE EDIT ALLOWED' : 'RULE EDIT BLOCKED');
}
function updateRulesPermissionQaPreview(){
  const preview = buildRulesPermissionQaPreview();
  setText('rulesDetectedRole', preview.detectedRole);
  setText('rulesOwnerEditResult', preview.required_tests.owner_can_edit ? 'PASS' : 'FAIL');
  setText('rulesAdminEditResult', preview.required_tests.admin_can_edit_if_allowed ? 'PASS' : 'FAIL');
  setText('rulesViewerUnauthorizedResult', preview.required_tests.viewer_cannot_edit && preview.required_tests.unauthorized_request_blocked ? 'PASS' : 'FAIL');
  setText('rulesPermissionQaJson', JSON.stringify(preview, null, 2));
  renderRulesPermissionQaTable(preview);
  applyRulesPermissionGate(preview);
  return preview;
}
async function copyRulesPermissionQaPreview(){
  const text = JSON.stringify(updateRulesPermissionQaPreview(), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('rulesPermissionQaSaveStatus');
    if(status){ status.textContent = 'Rules permission QA preview copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('rulesPermissionQaSaveStatus');
    if(status){ status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}
function saveRulesPermissionQaPreview(){
  const saved = { ...updateRulesPermissionQaPreview(), savedAt: new Date().toISOString() };
  localStorage.setItem(RULES_PERMISSION_QA_KEY, JSON.stringify(saved));
  const status = $('rulesPermissionQaSaveStatus');
  if(status){ status.textContent = 'Local permission QA snapshot saved safely. No backend write.'; status.className = 'rules-inline-status ok'; }
}
function resetRulesPermissionQaPreview(){
  localStorage.removeItem(RULES_PERMISSION_QA_KEY);
  const status = $('rulesPermissionQaSaveStatus');
  if(status){ status.textContent = 'Not saved yet.'; status.className = 'rules-inline-status'; }
  updateRulesPermissionQaPreview();
}
function restoreSavedRulesPermissionQaNote(){
  const saved = safeJsonParse(localStorage.getItem(RULES_PERMISSION_QA_KEY), null);
  if(!saved) return;
  const status = $('rulesPermissionQaSaveStatus');
  if(status){ status.textContent = `Existing local permission QA snapshot saved at ${saved.savedAt || 'unknown time'}.`; status.className = 'rules-inline-status ok'; }
}


const PROACTIVITY_REGISTRY_FALLBACK = [
  { trigger_key: 'roas_drop', label: 'ROAS drop', route: 'ads_specialist', severity: 'medium', summary: 'Flag meaningful blended ROAS declines for founder review.' },
  { trigger_key: 'new_support_ticket', label: 'New support ticket', route: 'support_specialist', severity: 'medium', summary: 'Surface new tickets without sending replies automatically.' },
  { trigger_key: 'scheduled_content_slot', label: 'Scheduled content slot', route: 'content_specialist', severity: 'low', summary: 'Remind founder of planned content windows without publishing.' },
  { trigger_key: 'weekly_ad_review', label: 'Weekly ad review', route: 'ads_specialist', severity: 'low', summary: 'Queue a weekly ads review without changing budgets.' },
  { trigger_key: 'pending_action_reminder', label: 'Pending action reminder', route: 'approval_queue', severity: 'low', summary: 'Remind founder about waiting approvals without approving them.' },
  { trigger_key: 'failed_executor_event', label: 'Failed executor event', route: 'manual_escalation', severity: 'high', summary: 'Keep failed executor events visible and never hidden.' },
];

function getAccordionSections(){
  return [
    { id: 'masterPauseSection', title: 'Master Pause', initiallyOpen: true },
    { id: 'contentRulesSection', title: 'Content Rules', initiallyOpen: false },
    { id: 'supportRulesSection', title: 'Support Rules', initiallyOpen: false },
    { id: 'adsRulesSection', title: 'Ads Rules', initiallyOpen: false },
    { id: 'globalCapsSection', title: 'Global Caps', initiallyOpen: false },
    { id: 'ruleSimulationSection', title: 'Simulation', initiallyOpen: false },
    { id: 'ruleHistorySection', title: 'History / Audit', initiallyOpen: false },
    { id: 'rulesPermissionQaSection', title: 'Permission QA', initiallyOpen: false },
    { id: 'proactivityTriggerSection', title: 'Proactivity', initiallyOpen: false },
  ];
}

function ensureRulesMobileSectionNav(){
  const hero = $('rulesOverviewSection');
  if(!hero || document.querySelector('.rules-mobile-section-nav')) return;
  const nav = document.createElement('nav');
  nav.className = 'rules-mobile-section-nav';
  nav.setAttribute('aria-label', 'Rules mobile section shortcuts');
  nav.innerHTML = getAccordionSections().map((item) => `<a href="#${item.id}">${item.title}</a>`).join('');
  hero.insertAdjacentElement('afterend', nav);
}

function setupRulesMobileAccordions(){
  getAccordionSections().forEach((item) => {
    const section = $(item.id);
    if(!section || section.dataset.mobileAccordionReady === 'true') return;
    section.dataset.mobileAccordionReady = 'true';
    const header = section.querySelector('.rules-section-head') || section.querySelector('.panel-header-row') || section.firstElementChild;
    if(!header) return;
    let body = section.querySelector(':scope > .rules-mobile-accordion-body');
    if(!body){
      body = document.createElement('div');
      body.className = 'rules-mobile-accordion-body';
      const children = Array.from(section.children).filter((child) => child !== header);
      children.forEach((child) => body.appendChild(child));
      section.appendChild(body);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rules-mobile-accordion-toggle';
    button.setAttribute('aria-expanded', item.initiallyOpen ? 'true' : 'false');
    button.innerHTML = `<span>${item.initiallyOpen ? 'Hide' : 'Show'} ${item.title}</span>`;
    header.appendChild(button);
    if(!item.initiallyOpen) section.classList.add('is-mobile-collapsed');
    button.addEventListener('click', () => {
      const collapsed = section.classList.toggle('is-mobile-collapsed');
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      button.querySelector('span').textContent = `${collapsed ? 'Show' : 'Hide'} ${item.title}`;
    });
  });
}

function renderProactivityRegistry(items, source){
  const registry = Array.isArray(items) && items.length ? items : PROACTIVITY_REGISTRY_FALLBACK;
  const list = $('proactivityTriggerRegistry');
  const pre = $('proactivityRegistryJson');
  if(list){
    list.innerHTML = registry.map((item) => {
      const key = item.triggerKey || item.trigger_key || item.key || 'unknown_trigger';
      const labelText = item.label || label(key);
      const route = item.futureRoute || item.route || item.specialist || 'manual_review';
      const severity = item.defaultSeverity || item.severity || 'low';
      const summary = item.summary || item.description || item.purpose || 'Safe trigger framework entry. Display only; no action is created.';
      return `<article class="proactivity-trigger-card"><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(label(route))} · ${escapeHtml(label(severity))}</strong><p>${escapeHtml(summary)}</p></article>`;
    }).join('');
  }
  const payload = {
    version: '0.8.3',
    phase: 'v0.8.3 Mobile Operator UI Release QA',
    source: source || 'static_fallback',
    mobileReadable: true,
    frameworkOnly: true,
    actionCreated: false,
    notificationSent: false,
    claudeCalled: false,
    toolInvoked: false,
    externalConnectorCalled: false,
    executorCalled: false,
    autoRunEnabled: false,
    triggers: registry,
  };
  if(pre) pre.textContent = JSON.stringify(payload, null, 2);
  setText('proactivityRegistryStatus', `${registry.length} trigger definitions visible. Framework only; no jobs or sends enabled.`);
  setText('proactivityRegistryBadge', source === 'api' ? 'API REGISTRY' : 'STATIC SAFE REGISTRY');
  return payload;
}

async function loadProactivityRegistry(){
  try{
    setText('proactivityRegistryStatus', 'Loading trigger registry…');
    const response = await fetch(`${API_BASE}/api/v1/orchestrator/proactivity-triggers/registry`, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
    if(!response.ok) throw new Error('Registry unavailable');
    const payload = await response.json();
    const data = payload.data || payload;
    const definitions = data.triggers || data.registry || data.definitions || data.triggerDefinitions || [];
    renderProactivityRegistry(definitions, 'api');
  }catch(error){
    renderProactivityRegistry(PROACTIVITY_REGISTRY_FALLBACK, 'static_fallback');
  }
}

async function copyProactivityRegistry(){
  const text = $('proactivityRegistryJson')?.textContent || JSON.stringify(renderProactivityRegistry(PROACTIVITY_REGISTRY_FALLBACK, 'static_fallback'), null, 2);
  try{
    await navigator.clipboard.writeText(text);
    const status = $('proactivityRegistryStatus');
    if(status){ status.textContent = 'Proactivity registry JSON copied.'; status.className = 'rules-inline-status ok'; }
  }catch{
    const status = $('proactivityRegistryStatus');
    if(status){ status.textContent = 'Copy unavailable. Select the JSON manually.'; status.className = 'rules-inline-status warn'; }
  }
}

function logout(){
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem(WORKSPACE_KEY);
  window.location.href = './login.html';
}
function initRulesPage(){
  updateAuthUi();
  loadAutonomyStatus();
  restoreSavedPreviewNote();
  restoreSavedContentPreviewNote();
  restoreSavedSupportPreviewNote();
  restoreSavedAdsPreviewNote();
  restoreSavedCapsPreviewNote();
  restoreSavedSimulationPreviewNote();
  restoreSavedPolicyAuditNote();
  restoreSavedRulesPermissionQaNote();
  updatePreview();
  updateContentRulePreview();
  updateSupportRulePreview();
  updateAdsRulePreview();
  updateCapsPreview();
  updateSimulationPreview();
  updatePolicyAuditPreview();
  updateRulesPermissionQaPreview();
  ensureRulesMobileSectionNav();
  setupRulesMobileAccordions();
  renderProactivityRegistry(PROACTIVITY_REGISTRY_FALLBACK, 'static_fallback');
  loadProactivityRegistry();
  showWizardStep(1);
  $('refreshAutonomyBtn')?.addEventListener('click', loadAutonomyStatus);
  $('logoutBtn')?.addEventListener('click', logout);
  $('wizardPrevBtn')?.addEventListener('click', () => showWizardStep(currentWizardStep - 1));
  $('wizardNextBtn')?.addEventListener('click', () => showWizardStep(currentWizardStep === TOTAL_WIZARD_STEPS ? 6 : currentWizardStep + 1));
  $('copyRulePreviewBtn')?.addEventListener('click', copyRulePreview);
  $('saveRulePreviewBtn')?.addEventListener('click', saveRulePreview);
  $('resetRuleWizardBtn')?.addEventListener('click', resetRuleWizard);
  $('copyContentRulePreviewBtn')?.addEventListener('click', copyContentRulePreview);
  $('saveContentRulePreviewBtn')?.addEventListener('click', saveContentRulePreview);
  $('resetContentRulePreviewBtn')?.addEventListener('click', resetContentRulePreview);
  $('copySupportRulePreviewBtn')?.addEventListener('click', copySupportRulePreview);
  $('saveSupportRulePreviewBtn')?.addEventListener('click', saveSupportRulePreview);
  $('resetSupportRulePreviewBtn')?.addEventListener('click', resetSupportRulePreview);
  $('copyAdsRulePreviewBtn')?.addEventListener('click', copyAdsRulePreview);
  $('saveAdsRulePreviewBtn')?.addEventListener('click', saveAdsRulePreview);
  $('resetAdsRulePreviewBtn')?.addEventListener('click', resetAdsRulePreview);
  $('copyCapsPreviewBtn')?.addEventListener('click', copyCapsPreview);
  $('saveCapsPreviewBtn')?.addEventListener('click', saveCapsPreview);
  $('resetCapsPreviewBtn')?.addEventListener('click', resetCapsPreview);
  $('runSimulationBtn')?.addEventListener('click', updateSimulationPreview);
  $('copySimulationPreviewBtn')?.addEventListener('click', copySimulationPreview);
  $('saveSimulationPreviewBtn')?.addEventListener('click', saveSimulationPreview);
  $('resetSimulationPreviewBtn')?.addEventListener('click', resetSimulationPreview);
  $('refreshPolicyAuditBtn')?.addEventListener('click', updatePolicyAuditPreview);
  $('copyPolicyAuditBtn')?.addEventListener('click', copyPolicyAuditPreview);
  $('savePolicyAuditBtn')?.addEventListener('click', savePolicyAuditPreview);
  $('resetPolicyAuditBtn')?.addEventListener('click', resetPolicyAuditPreview);
  $('runRulesPermissionQaBtn')?.addEventListener('click', updateRulesPermissionQaPreview);
  $('copyRulesPermissionQaBtn')?.addEventListener('click', copyRulesPermissionQaPreview);
  $('saveRulesPermissionQaBtn')?.addEventListener('click', saveRulesPermissionQaPreview);
  $('resetRulesPermissionQaBtn')?.addEventListener('click', resetRulesPermissionQaPreview);
  $('refreshProactivityRegistryBtn')?.addEventListener('click', loadProactivityRegistry);
  $('copyProactivityRegistryBtn')?.addEventListener('click', copyProactivityRegistry);
  $('ruleWizardForm')?.addEventListener('input', updatePreview);
  $('ruleWizardForm')?.addEventListener('change', updatePreview);
  $('contentRulesForm')?.addEventListener('input', updateContentRulePreview);
  $('contentRulesForm')?.addEventListener('change', updateContentRulePreview);
  $('supportRulesForm')?.addEventListener('input', updateSupportRulePreview);
  $('supportRulesForm')?.addEventListener('change', updateSupportRulePreview);
  $('adsRulesForm')?.addEventListener('input', updateAdsRulePreview);
  $('adsRulesForm')?.addEventListener('change', updateAdsRulePreview);
  $('capsSettingsForm')?.addEventListener('input', updateCapsPreview);
  $('capsSettingsForm')?.addEventListener('change', updateCapsPreview);
  $('ruleSimulationForm')?.addEventListener('input', updateSimulationPreview);
  $('ruleSimulationForm')?.addEventListener('change', updateSimulationPreview);
  $('rulesPermissionQaForm')?.addEventListener('input', updateRulesPermissionQaPreview);
  $('rulesPermissionQaForm')?.addEventListener('change', updateRulesPermissionQaPreview);
  ['ruleWizardForm','contentRulesForm','supportRulesForm','adsRulesForm','capsSettingsForm','ruleSimulationForm'].forEach((formId) => {
    $(formId)?.addEventListener('input', updatePolicyAuditPreview);
    $(formId)?.addEventListener('change', updatePolicyAuditPreview);
  });
}


document.addEventListener('DOMContentLoaded', initRulesPage);
