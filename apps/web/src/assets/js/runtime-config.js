(function () {
  var existing = window.LIFESAVER_API_BASE;
  if (existing && typeof existing === 'string') return;

  var publicConfig = window.LIFESAVER_PUBLIC_CONFIG || {};
  if (publicConfig.apiBase && typeof publicConfig.apiBase === 'string') {
    window.LIFESAVER_API_BASE = publicConfig.apiBase;
    return;
  }

  var loc = window.location;
  var host = loc.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';

  // Local Vite frontend runs on port 3000 and talks to the local API on port 4000.
  if (isLocal) {
    window.LIFESAVER_API_BASE = 'http://localhost:4000';
    return;
  }

  // Render single-service deployments serve static web and API from the same origin.
  if (host.indexOf('.onrender.com') !== -1) {
    window.LIFESAVER_API_BASE = loc.origin;
    return;
  }

  // v0.5.2 product-surface model: app/admin/public can talk to api.<root-domain>.
  // Example: app.mydomain.com -> api.mydomain.com, admin.mydomain.com -> api.mydomain.com.
  var parts = host.split('.');
  if (parts.length >= 3 && ['app', 'admin', 'www'].indexOf(parts[0]) !== -1) {
    parts[0] = 'api';
    window.LIFESAVER_API_BASE = loc.protocol + '//' + parts.join('.');
    return;
  }

  // Fallback for same-origin deployments.
  window.LIFESAVER_API_BASE = loc.origin;
}());
