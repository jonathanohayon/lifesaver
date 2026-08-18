(function () {
  const apiBase = window.LIFESAVER_API_BASE || 'http://localhost:4000';
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function listItems(items) {
    return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  async function loadSurfaceModel() {
    const res = await fetch(`${apiBase}/api/v1/product-surfaces`, { cache: 'no-store' });
    const payload = await res.json();
    if (!res.ok || !payload.success) throw new Error(payload?.error?.message || 'Unable to load product surface model.');
    return payload.data;
  }

  function render(model) {
    $('surfaceVersion').textContent = model.version || '—';
    $('surfaceMode').textContent = model.mode || '—';
    $('apiUrl').textContent = model.configuredUrls?.apiUrl || '—';

    $('surfaceMap').innerHTML = (model.surfaces || []).map((surface) => `
      <div class="surface-card">
        <div class="surface-card-head">
          <h3>${escapeHtml(surface.name)}</h3>
          <span>${escapeHtml(surface.productionUrl)}</span>
        </div>
        <p>${escapeHtml(surface.purpose)}</p>
        <div class="grid two compact">
          <div class="mini"><span>Audience</span><strong>${escapeHtml(surface.audience)}</strong></div>
          <div class="mini"><span>Owns Secrets</span><strong>${surface.ownsSecrets ? 'YES' : 'NO'}</strong></div>
        </div>
        <div class="surface-columns">
          <div class="note"><strong>Allowed</strong><ul>${listItems(surface.allowedAccess)}</ul></div>
          <div class="note warn"><strong>Forbidden</strong><ul>${listItems(surface.explicitlyForbidden)}</ul></div>
        </div>
        <div class="surface-notes"><ul>${listItems(surface.notes)}</ul></div>
      </div>
    `).join('');

    $('secretRules').innerHTML = (model.secretOwnership || []).map((rule) => `
      <div class="row">
        <div>
          <strong>${escapeHtml(rule.secret)}</strong><br>
          <small>${escapeHtml(rule.owner)} · ${escapeHtml(rule.storage)}</small>
          <p>${escapeHtml(rule.managedBy)}. ${escapeHtml(rule.browserVisibility)}</p>
        </div>
      </div>
    `).join('');

    $('safetyRules').innerHTML = (model.v1SafetyRules || []).map((rule) => `<div class="note"><strong>Rule</strong><br>${escapeHtml(rule)}</div>`).join('');
    $('nextNotes').innerHTML = (model.nextImplementationNotes || []).map((note) => `<div class="row"><div><strong>Next</strong><br><small>${escapeHtml(note)}</small></div></div>`).join('');
  }

  loadSurfaceModel().then(render).catch((err) => {
    $('surfaceMessage').className = 'danger';
    $('surfaceMessage').textContent = err.message;
  });
}());
