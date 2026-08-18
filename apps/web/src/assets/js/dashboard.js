// LIFE.SAVER v0.8.3 Mobile Operator UI Release QA
// Mobile-only dashboard helpers. This does not change API, policy, executor, or action behavior.
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function byId(id) { return document.getElementById(id); }

  function setIdOnce(el, id) {
    if (el && !el.id) el.id = id;
  }

  function findPanelByHeading(text) {
    var headings = Array.prototype.slice.call(document.querySelectorAll('.panel h3'));
    var match = headings.find(function (h) { return h.textContent.trim().toLowerCase() === text.toLowerCase(); });
    return match ? match.closest('.panel') : null;
  }

  function scrollToTarget(selector) {
    var node = document.querySelector(selector);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildMobileJumpbar() {
    if (document.querySelector('.ls-dashboard-mobile-jumpbar')) return;
    var brief = document.querySelector('.brief');
    if (!brief || !brief.parentNode) return;

    var interfacePanel = document.querySelector('.interface');
    var growthPanel = findPanelByHeading('Growth Metrics');
    var draftsPanel = findPanelByHeading('Draft Review Panel');
    var weeklyPanel = document.querySelector('.weekly');

    setIdOnce(interfacePanel, 'ls-dashboard-chat');
    setIdOnce(growthPanel, 'ls-dashboard-kpis');
    setIdOnce(draftsPanel, 'ls-dashboard-drafts');
    setIdOnce(weeklyPanel, 'ls-dashboard-weekly');

    var bar = document.createElement('div');
    bar.className = 'ls-dashboard-mobile-jumpbar';
    bar.setAttribute('aria-label', 'Mobile dashboard quick navigation');
    bar.innerHTML = [
      '<button type="button" class="ls-dashboard-jump" data-target=".brief">Daily Brief</button>',
      '<button type="button" class="ls-dashboard-jump" data-target="#ls-dashboard-chat">AI Chat</button>',
      '<button type="button" class="ls-dashboard-jump" data-target="#ls-dashboard-kpis">KPI Cards</button>',
      '<button type="button" class="ls-dashboard-jump" data-target="#ls-dashboard-drafts">Drafts</button>',
      '<button type="button" class="ls-dashboard-jump" data-target="#ls-dashboard-weekly">Weekly Summary</button>',
      '<button type="button" class="ls-dashboard-jump" data-target=".nav">Sections</button>',
      '<div class="ls-dashboard-mobile-note">Mobile dashboard mode keeps all founder functions visible without horizontal scrolling.</div>'
    ].join('');

    bar.addEventListener('click', function (event) {
      var button = event.target.closest('[data-target]');
      if (!button) return;
      scrollToTarget(button.getAttribute('data-target'));
    });

    brief.insertAdjacentElement('afterend', bar);
  }

  function makeChipsKeyboardAccessible() {
    document.querySelectorAll('.brief-actions .chip').forEach(function (chip) {
      if (!chip.hasAttribute('tabindex')) chip.setAttribute('tabindex', '0');
      chip.setAttribute('role', 'button');
      chip.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chip.click();
        }
      });
    });
  }

  function bindDashboardClicks() {
    var focusDraftsTab = byId('focusDraftsTab');
    if (focusDraftsTab && !focusDraftsTab.dataset.mobileDashboardBound) {
      focusDraftsTab.dataset.mobileDashboardBound = 'true';
      focusDraftsTab.addEventListener('click', function () { scrollToTarget('#ls-dashboard-drafts'); });
    }

    document.querySelectorAll('.brief-actions .chip').forEach(function (chip) {
      if (chip.dataset.mobileDashboardBound) return;
      chip.dataset.mobileDashboardBound = 'true';
      chip.addEventListener('click', function () {
        var label = chip.textContent.toLowerCase();
        if (label.indexOf('draft') !== -1 || label.indexOf('support') !== -1) scrollToTarget('#ls-dashboard-drafts');
        else scrollToTarget('#ls-dashboard-chat');
      });
    });
  }

  function markPanels() {
    document.querySelector('.brief')?.classList.add('dashboard-panel-daily-brief');
    document.querySelector('.weekly')?.classList.add('dashboard-panel-weekly-summary');
    findPanelByHeading('Growth Metrics')?.classList.add('dashboard-panel-kpis');
    findPanelByHeading('Revenue Stream')?.classList.add('dashboard-panel-revenue-stream');
    findPanelByHeading('Draft Review Panel')?.classList.add('dashboard-panel-drafts');
    document.querySelector('.interface')?.classList.add('dashboard-panel-chat');
  }

  function setViewportClass() {
    var root = document.documentElement;
    root.classList.toggle('ls-dashboard-phone', window.innerWidth <= 680);
    root.classList.toggle('ls-dashboard-tablet', window.innerWidth > 680 && window.innerWidth <= 1180);
  }

  ready(function () {
    document.body.classList.add('ls-dashboard-v072-ready');
    markPanels();
    buildMobileJumpbar();
    makeChipsKeyboardAccessible();
    bindDashboardClicks();
    setViewportClass();
    window.addEventListener('resize', setViewportClass, { passive: true });
  });
})();
