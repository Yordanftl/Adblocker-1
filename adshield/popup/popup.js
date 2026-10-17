'use strict';

/**
 * AdShield popup controller.
 *
 * When opened as a real extension popup it talks to the background worker
 * via runtime messages. When opened as a plain file (e.g. for screenshot
 * generation) it renders with demo data instead.
 */

const IS_EXTENSION =
  typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;

const els = {
  toggle: document.getElementById('toggle'),
  statusText: document.getElementById('statusText'),
  pageCount: document.getElementById('pageCount'),
  totalCount: document.getElementById('totalCount'),
  siteSection: document.getElementById('siteSection'),
  hostname: document.getElementById('hostname'),
  siteBtn: document.getElementById('siteBtn'),
  optionsLink: document.getElementById('optionsLink'),
};

const DEMO_STATE = {
  enabled: true,
  totalBlocked: 12483,
  pageBlocked: 37,
  hostname: 'example.com',
  whitelisted: false,
};

let state = { ...DEMO_STATE };

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function loadState() {
  if (!IS_EXTENSION) return { ...DEMO_STATE };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? tab.url : '';
  const hostname = hostnameFromUrl(url);

  const s = await chrome.runtime.sendMessage({
    type: 'getState',
    tabId: tab && tab.id != null ? tab.id : -1,
  });

  return {
    enabled: s.enabled,
    totalBlocked: s.totalBlocked,
    pageBlocked: s.pageBlocked,
    hostname,
    whitelisted: hostname ? s.whitelist.includes(hostname) : false,
    unsupported: !/^https?:/.test(url),
  };
}

function render() {
  els.toggle.checked = state.enabled;
  els.statusText.textContent = state.enabled
    ? 'Protection on'
    : 'Paused everywhere';
  document.body.classList.toggle('disabled', !state.enabled);

  els.pageCount.textContent = state.enabled
    ? state.pageBlocked.toLocaleString()
    : '—';
  els.totalCount.textContent = state.totalBlocked.toLocaleString();

  if (state.unsupported || !state.hostname) {
    els.siteSection.classList.add('hidden');
  } else {
    els.siteSection.classList.remove('hidden');
    els.hostname.textContent = state.hostname;
    els.hostname.title = state.hostname;
    els.siteBtn.textContent = state.whitelisted
      ? 'Resume on this site'
      : 'Pause on this site';
  }
}

/* ------------------------------ events ------------------------------ */

els.toggle.addEventListener('change', async () => {
  state.enabled = els.toggle.checked;
  render();
  if (IS_EXTENSION) {
    await chrome.runtime.sendMessage({
      type: 'setEnabled',
      enabled: state.enabled,
    });
    state = await loadState();
    render();
  }
});

els.siteBtn.addEventListener('click', async () => {
  if (!state.hostname) return;
  if (IS_EXTENSION) {
    const res = await chrome.runtime.sendMessage({
      type: 'toggleWhitelist',
      hostname: state.hostname,
    });
    state.whitelisted = !!(res && res.whitelisted);
  } else {
    state.whitelisted = !state.whitelisted;
  }
  render();
});

els.optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (IS_EXTENSION) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open('../options/options.html', '_blank');
  }
});

/* ------------------------------ init ------------------------------ */

(async () => {
  state = await loadState();
  render();
})();
