// LIFE.SAVER v0.8.4 Conversion + Reach Source Mapping
// Read-only homepage widget. It does not call social APIs, create actions, call executors, or write externally.
(function () {
  var TOKEN_KEY = 'lifesaver_auth_token';
  var API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';

  function byId(id) { return document.getElementById(id); }
  function setText(id, value) { var el = byId(id); if (el) el.textContent = value; }
  function setTitle(id, value) { var el = byId(id); if (el) el.setAttribute('title', value || ''); }
  function headers() {
    var token = localStorage.getItem(TOKEN_KEY) || '';
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  function statusClass(status) {
    if (status === 'LIVE') return 'tag ls-audience-live';
    if (status === 'DERIVED') return 'tag ls-audience-derived';
    if (status === 'PENDING') return 'tag amber-tag';
    return 'tag amber-tag';
  }

  function applyAudienceReach(report) {
    if (!report || !report.metrics) return;
    var status = byId('audienceReachStatus');
    if (status) {
      status.textContent = report.statusLabel || 'SAFE';
      status.className = statusClass(report.statusLabel || 'SAFE');
      status.title = report.sourceStatus || 'read-only metrics source';
    }

    setText('audienceReachSub', report.sourceLabel || 'Read-only metrics derived');

    var customers = report.metrics.customers || {};
    var reach = report.metrics.estimatedReach || {};
    var channels = report.metrics.activeChannels || {};
    var engagement = report.metrics.engagementRate || {};

    setText('audienceMetricOneLabel', customers.label || 'Customers');
    setText('audienceCustomers', customers.displayValue || 'Awaiting Data');
    setTitle('audienceCustomers', customers.source || 'orders from latest metrics snapshot');

    setText('audienceMetricTwoLabel', reach.label || 'Reach Est.');
    setText('audienceReachEstimate', reach.displayValue || 'Awaiting Sessions');
    setTitle('audienceReachEstimate', reach.source || 'requires sessions/visitors or confirmed conversion rate');

    setText('audienceMetricThreeLabel', channels.label || 'Channels');
    setText('audienceChannels', channels.displayValue || 'Awaiting Data');
    setTitle('audienceChannels', channels.source || 'channel data not confirmed yet');

    setText('audienceMetricFourLabel', engagement.label || 'Conv.');
    setText('audienceEngagement', engagement.displayValue || 'Awaiting Sessions');
    setTitle('audienceEngagement', engagement.guidance || engagement.source || 'conversion rate mapping needed');

    var platform = report.metrics.activePlatformConversion || {};
    var platformText = platform.displayValue && platform.displayValue !== 'Awaiting Data' ? ' Platform Conv. Value: ' + platform.displayValue + ' (' + (platform.source || 'active platform sources') + ').' : '';
    var needsMapping = (report.realValueRequirements || []).filter(function(item){ return item.status === 'needs_mapping'; });
    var note = needsMapping.length
      ? needsMapping.map(function(item){ return item.label + ': ' + item.requirement; }).join(' • ') + platformText
      : (report.notes && report.notes.length ? report.notes[report.notes.length - 1] : 'Audience reach is calculated from read-only verified metrics.');
    setText('audienceMappingNote', note);

    document.body.classList.add('ls-audience-reach-functional');
    window.LIFESAVER_AUDIENCE_REACH_SIGNAL = report.mapSignal || null;
  }

  function applyAudienceReachFallback(message) {
    var status = byId('audienceReachStatus');
    if (status) {
      status.textContent = 'AWAITING';
      status.className = 'tag amber-tag';
      status.title = message || 'Audience reach API unavailable.';
    }
    setText('audienceReachSub', 'Waiting for metrics API');
    setText('audienceCustomers', 'Awaiting Data');
    setText('audienceReachEstimate', 'Awaiting Sessions');
    setText('audienceChannels', 'Awaiting Data');
    setText('audienceEngagement', 'Awaiting Sessions');
    setText('audienceMappingNote', message || 'Load metrics first, then map sessions/visitors or confirm a non-zero conversion rate before reach and conversion values can be displayed.');
  }

  async function loadAudienceReach() {
    try {
      var res = await fetch(API_BASE + '/api/v1/audience-reach', { headers: headers() });
      var json = await res.json();
      if (json && json.error && json.error.code === 'AUTH_REQUIRED') {
        applyAudienceReachFallback('Please log in to load audience reach.');
        return;
      }
      if (!res.ok || !json.success || !json.data) throw new Error((json.error && json.error.message) || 'Audience reach API unavailable.');
      applyAudienceReach(json.data);
    } catch (error) {
      console.warn('LIFE.SAVER audience reach API not available yet.', error);
      applyAudienceReachFallback(error && error.message ? error.message : 'Audience reach API unavailable.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAudienceReach);
  else loadAudienceReach();
})();
