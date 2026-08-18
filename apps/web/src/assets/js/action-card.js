(function(){
  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function label(value){
    return String(value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, function(char){ return char.toUpperCase(); });
  }

  function formatDate(value){
    if(!value) return '—';
    var date = new Date(value);
    if(Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  }

  function firstText(){
    for(var i = 0; i < arguments.length; i += 1){
      var value = arguments[i];
      if(typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  function readPreview(detail){
    return (((detail || {}).payloadPreview || {}).preview) || {};
  }

  function inferPlatform(action, detail){
    var preview = readPreview(detail);
    return firstText(
      action && action.platform,
      preview.platform,
      preview.supportProvider,
      preview.channel,
      preview.targetLevel,
      action && action.actionType === 'research_task' ? 'Internal Research' : null,
      action && action.actionType === 'dev_task' ? 'Internal Dev' : null,
      action && action.actionType === 'rollback_action' ? 'Internal Rollback' : null,
      action && action.actionType === 'notification_send' ? 'In-App / Notification' : null,
      'To be confirmed'
    );
  }

  function inferCategory(action, detail){
    var preview = readPreview(detail);
    var type = String(action && action.actionType || '').toLowerCase();
    return firstText(
      action && action.category,
      preview.category,
      preview.ticketCategory,
      preview.contentType,
      preview.targetLevel,
      type === 'support_reply_send' ? 'Support' : null,
      type === 'content_publish' ? 'Content' : null,
      type === 'ad_budget_adjust' || type === 'ad_pause' ? 'Ads' : null,
      type === 'rollback_action' ? 'Rollback' : null,
      'General'
    );
  }

  function shortReason(action, detail){
    var preview = readPreview(detail);
    return firstText(
      action && action.description,
      detail && detail.payloadPreview && detail.payloadPreview.intentSummary,
      preview.reasonPreview,
      preview.approvalNotesPreview,
      preview.captionPreview,
      preview.replyBodyPreview,
      preview.questionPreview,
      preview.taskSummaryPreview,
      'No short reason has been added yet.'
    );
  }


  function normalizeRisk(value){
    var risk = String(value || 'medium').toLowerCase();
    return ['low','medium','high','critical'].indexOf(risk) >= 0 ? risk : 'medium';
  }

  function riskBadgeLabel(risk){
    risk = normalizeRisk(risk);
    if(risk === 'critical') return 'Critical Risk';
    if(risk === 'high') return 'High Risk';
    if(risk === 'medium') return 'Medium Risk';
    return 'Low Risk';
  }

  function riskBadgeMessage(risk){
    risk = normalizeRisk(risk);
    if(risk === 'critical') return 'Founder-level scrutiny required. Never auto-run without explicit policy, caps, and pause protection.';
    if(risk === 'high') return 'High-impact action. Review platform, payload, and business effect before approving.';
    if(risk === 'medium') return 'Review brand fit, timing, customer context, and source data before approving.';
    return 'Routine internal review. Still confirm the details before approving.';
  }

  function stringifySafe(value){
    try { return JSON.stringify(value || {}).toLowerCase(); } catch(error) { return ''; }
  }

  function criticalWarningTriggers(action, detail){
    var preview = readPreview(detail);
    var type = String(action && action.actionType || '').toLowerCase();
    var text = stringifySafe(preview) + ' ' + String(action && action.title || '').toLowerCase() + ' ' + String(action && action.description || '').toLowerCase();
    var triggers = [];
    if(type === 'ad_budget_adjust' || type === 'ad_pause') triggers.push('Ad spend/campaign control');
    if(type === 'support_reply_send' && (preview.bulkSend === true || Number(preview.recipientCount || 0) > 1 || /bulk|multiple recipients|mass reply/.test(text))) triggers.push('Bulk support send');
    if(type === 'support_reply_send' && /refund|chargeback|return|replacement|cancel|cancellation/.test(text)) triggers.push('Refund-related support reply');
    if(type === 'support_reply_send' && /complaint|angry|unusual|legal|threat|escalat|sensitive|vip|high value/.test(text)) triggers.push('Unusual/sensitive customer complaint');
    return triggers;
  }

  function renderRiskAlert(action, detail){
    var risk = normalizeRisk(action && action.riskLevel);
    var triggers = criticalWarningTriggers(action, detail);
    var shouldShow = risk === 'critical' || risk === 'high' || triggers.length > 0;
    if(!shouldShow) return '';
    var critical = risk === 'critical' || triggers.length > 0;
    var title = critical ? 'Critical Warning' : 'High-Risk Review';
    var triggerText = triggers.length ? ' Trigger: ' + triggers.join(' · ') + '.' : '';
    return '<div class="action-risk-alert ' + (critical ? 'risk-alert-critical' : 'risk-alert-high') + '"><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(riskBadgeMessage(critical ? 'critical' : risk) + triggerText) + '</span></div>';
  }

  function cardSafetyNote(action){
    var status = action && action.status;
    if(status === 'executed') return 'Executed actions cannot be cancelled here. Future rollback flow is required.';
    if(status === 'approved') return 'Approved internally only. No executor is enabled in this UI phase.';
    if(status === 'rejected') return 'Rejected internally. No external action was performed.';
    if(status === 'cancelled') return 'Cancelled internally before execution. No external action was performed.';
    return 'v0.8.3 mobile-safe approval review. Approve, reject, and internal cancel controls use large touch targets and safe confirmation steps.';
  }

  function renderActionCard(action, detail, options){
    options = options || {};
    var id = action && action.id ? String(action.id) : '';
    var status = action && action.status ? String(action.status) : 'unknown';
    var risk = action && action.riskLevel ? String(action.riskLevel) : 'medium';
    var type = action && action.actionType ? String(action.actionType) : 'unknown';
    var platform = inferPlatform(action, detail);
    var category = inferCategory(action, detail);
    var reason = shortReason(action, detail);
    var title = action && action.title ? action.title : 'Untitled action';
    var created = formatDate(action && action.createdAt);
    var policy = action && action.policyDecision ? action.policyDecision : 'ask';
    var approval = action && action.approvalRequired ? 'Required' : 'Not required';
    var detailHref = options.detailHref || ('#action-' + encodeURIComponent(id));

    return '' +
      '<article class="action-card" data-action-id="' + escapeHtml(id) + '" data-status="' + escapeHtml(status) + '" data-risk="' + escapeHtml(risk) + '">' +
        '<div class="action-card-header">' +
          '<span class="action-pill status-' + escapeHtml(status) + '">' + escapeHtml(label(status)) + '</span>' +
          '<span class="action-risk-badge risk-' + escapeHtml(normalizeRisk(risk)) + '" title="' + escapeHtml(riskBadgeMessage(risk)) + '"><span class="risk-dot"></span>' + escapeHtml(riskBadgeLabel(risk)) + '</span>' +
        '</div>' +
        '<h3 class="action-card-title">' + escapeHtml(title) + '</h3>' +
        '<p class="action-card-description">' + escapeHtml(reason) + '</p>' +
        '<div class="action-card-mobile-summary" aria-label="Mobile action summary">' +
          '<span><strong>Status</strong>' + escapeHtml(label(status)) + '</span>' +
          '<span><strong>Risk</strong>' + escapeHtml(riskBadgeLabel(risk)) + '</span>' +
          '<span><strong>Category</strong>' + escapeHtml(category) + '</span>' +
          '<span><strong>Created</strong>' + escapeHtml(created) + '</span>' +
        '</div>' +
        renderRiskAlert(action, detail) +
        '<div class="action-card-meta">' +
          '<div class="action-meta-item"><span>Type</span><strong>' + escapeHtml(label(type)) + '</strong></div>' +
          '<div class="action-meta-item"><span>Category</span><strong>' + escapeHtml(category) + '</strong></div>' +
          '<div class="action-meta-item"><span>Platform</span><strong>' + escapeHtml(platform) + '</strong></div>' +
          '<div class="action-meta-item"><span>Created</span><strong>' + escapeHtml(created) + '</strong></div>' +
          '<div class="action-meta-item"><span>Policy</span><strong>' + escapeHtml(label(policy)) + ' · ' + escapeHtml(approval) + '</strong></div>' +
        '</div>' +
        '<div class="action-card-actions" aria-label="Mobile-safe action controls">' +
          '<a class="btn detail" href="' + escapeHtml(detailHref) + '" data-action-control="detail" data-action-id="' + escapeHtml(id) + '">View Details</a>' +
          '<button class="btn primary" type="button" data-action-control="approve" data-action-id="' + escapeHtml(id) + '" title="Open approve confirmation modal. Approval remains internal only.">Approve</button>' +
          '<button class="btn reject" type="button" data-action-control="reject" data-action-id="' + escapeHtml(id) + '" title="Open reject-with-reason modal. Rejection remains internal only.">Reject</button>' +
          '<button class="btn cancel" type="button" data-action-control="cancel" data-action-id="' + escapeHtml(id) + '" title="Open internal cancellation confirmation. Cancellation cannot execute external actions.">Cancel</button>' +
        '</div>' +
        '<div class="action-card-footer-note"><span class="action-safe-lock">SAFE:</span> ' + escapeHtml(cardSafetyNote(action)) + '</div>' +
      '</article>';
  }

  function renderActionEmpty(message){
    return '<article class="action-card action-card-empty"><div class="action-card-header"><span class="action-pill">EMPTY</span><span class="action-pill risk-low">SAFE</span></div><h3 class="action-card-title">No actions found</h3><p class="action-card-description">' + escapeHtml(message || 'There are no workspace actions matching the current filters.') + '</p><div class="action-card-footer-note"><span class="action-safe-lock">SAFE:</span> No external writes are enabled.</div></article>';
  }

  window.LifeSaverActionCard = {
    renderActionCard: renderActionCard,
    renderActionEmpty: renderActionEmpty,
    inferPlatform: inferPlatform,
    inferCategory: inferCategory,
    shortReason: shortReason,
    label: label,
    formatDate: formatDate,
    normalizeRisk: normalizeRisk,
    riskBadgeLabel: riskBadgeLabel,
    riskBadgeMessage: riskBadgeMessage,
    criticalWarningTriggers: criticalWarningTriggers,
    renderRiskAlert: renderRiskAlert
  };
}());
