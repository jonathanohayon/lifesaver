// LIFE.SAVER mobile shell controller
// Adds a safe hamburger/mobile menu and applies shared version labels.
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function getVersion() {
    return window.LIFESAVER_APP_VERSION || {
      version: '0.8.5',
      label: 'Active Platform Conversion',
      healthMode: 'v2-functional-0-8-5-claude-backend-compatibility'
    };
  }

  function setText(selector, text) {
    document.querySelectorAll(selector).forEach(function (node) {
      node.textContent = text;
    });
  }

  function applyVersionLabels() {
    var meta = getVersion();
    document.documentElement.setAttribute('data-lifesaver-version', meta.version);
    document.documentElement.setAttribute('data-lifesaver-health-mode', meta.healthMode);
    setText('[data-ls-version]', meta.version);
    setText('[data-ls-version-label]', meta.label);
    setText('[data-ls-health-mode]', meta.healthMode);

    var appVersion = document.getElementById('appVersion');
    if (appVersion && (appVersion.textContent.trim() === '' || appVersion.textContent.trim() === '—' || /^0\./.test(appVersion.textContent.trim()))) {
      appVersion.textContent = meta.version;
    }

    document.querySelectorAll('[data-ls-version-small]').forEach(function (node) {
      node.textContent = meta.label;
    });
  }

  function buildMenuButton(label, controlsId) {
    var button = document.createElement('button');
    button.className = 'btn ls-mobile-menu-toggle';
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', controlsId);
    button.innerHTML = '<span class="ls-mobile-menu-icon" aria-hidden="true">☰</span><span>' + label + '</span>';
    return button;
  }

  function enhanceTopbarNavigation() {
    document.querySelectorAll('.topbar').forEach(function (topbar, index) {
      var actions = topbar.querySelector('.footer-actions');
      if (!actions || topbar.querySelector('.ls-mobile-menu-toggle')) return;
      var id = actions.id || 'ls-mobile-topbar-menu-' + (index + 1);
      actions.id = id;
      actions.classList.add('ls-mobile-collapsible-menu');
      var button = buildMenuButton('Menu', id);
      var brand = topbar.querySelector('.brand');
      if (brand && brand.parentNode === topbar) {
        brand.insertAdjacentElement('afterend', button);
      } else {
        topbar.insertBefore(button, actions);
      }
      button.addEventListener('click', function () {
        var open = actions.classList.toggle('is-mobile-open');
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('ls-mobile-menu-open', open);
      });
    });
  }

  function enhanceDashboardNavigation() {
    var nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('.ls-dashboard-menu-toggle')) return;
    var tabs = nav.querySelector('.tabs');
    if (!tabs) return;
    var id = tabs.id || 'ls-dashboard-mobile-tabs';
    tabs.id = id;
    tabs.classList.add('ls-dashboard-tabs');
    var button = buildMenuButton('Sections', id);
    button.classList.add('ls-dashboard-menu-toggle');
    nav.insertBefore(button, tabs);
    button.addEventListener('click', function () {
      var open = nav.classList.toggle('is-mobile-open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    if (!nav.querySelector('.ls-dashboard-version-chip')) {
      var meta = getVersion();
      var chip = document.createElement('span');
      chip.className = 'ls-dashboard-version-chip';
      chip.textContent = 'v' + meta.version;
      nav.appendChild(chip);
    }
  }

  function markShellReady() {
    document.body.classList.add('ls-mobile-shell-ready');
  }

  ready(function () {
    applyVersionLabels();
    enhanceTopbarNavigation();
    enhanceDashboardNavigation();
    markShellReady();
  });
})();
