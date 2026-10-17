'use strict';

/**
 * AdShield options page controller.
 *
 * Reads state from the background worker via runtime messages and renders
 * stats, ruleset toggles, the whitelist and custom blocked domains.
 * Falls back to demo data when opened as a plain file (screenshots/docs).
 */

const IS_EXTENSION =
  typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;

const RULESET_FILES = {
  ruleset_ads: { file: 'ads.json', countEl: 'countAds', label: 'ad networks' },
  ruleset_trackers: { file: 'trackers.json', countEl: 'countTrackers', label: 'tracking services' },
  ruleset_annoyances: { file: 'annoyances.json', countEl: 'countAnnoyances', label: 'push/popup services' },
};

// Demo values used when the page is opened outside the extension.
const DEMO = {
  totalBlocked: 12483,
  installDate: Date.now() - 1000 * 60 * 60 * 24 * 41,
  whitelist: ['example.com', 'news.ycombinator.com'],
  customBlocked: ['promo-tracker.example'],
  rulesetStates: { ruleset_ads: true, ruleset_trackers: true, ruleset_annoyances: true },
  ruleCounts: { ruleset_ads: 87, ruleset_trackers: 50, ruleset_annoyances: 22 },
};

let state = {
  enabled: true,
  totalBlocked: 0,
  installDate: 0,
  whitelist: [],
  customBlocked: [],
  rulesetStates: {},
};
let ruleCounts = { ruleset_ads: 0, ruleset_trackers: 0, ruleset_annoyances: 0 };

/* ------------------------------ data ------------------------------ */

async function loadState() {
  if (!IS_EXTENSION) {
    state = { enabled: true, ...DEMO };
    ruleCounts = { ...DEMO.ruleCounts };
    return;
  }
  const s = await chrome.runtime.sendMessage({ type: 'getState', tabId: -1 });
  state = s;

  // Count the rules bundled in each static ruleset file.
  for (const [id, meta] of Object.entries(RULESET_FILES)) {
    try {
      const res = await fetch(chrome.runtime.getURL(`rulesets/${meta.file}`));
      const rules = await res.json();
      ruleCounts[id] = rules.length;
    } catch {
      ruleCounts[id] = 0;
    }
  }
}

async function send(msg) {
  if (!IS_EXTENSION) return { ok: true };
  return chrome.runtime.sendMessage(msg);
}

/* ------------------------------ render ------------------------------ */

function renderStats() {
  document.getElementById('statTotal').textContent =
    state.totalBlocked.toLocaleString();
  const activeRules = Object.entries(state.rulesetStates || {})
    .filter(([, on]) => on !== false)
    .reduce((sum, [id]) => sum + (ruleCounts[id] || 0), 0);
  document.getElementById('statRules').textContent =
    activeRules.toLocaleString();
  document.getElementById('statWhitelist').textContent =
    state.whitelist.length.toLocaleString();
  document.getElementById('statSince').textContent = state.installDate
    ? new Date(state.installDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
      })
    : '—';
}

function renderRulesets() {
  for (const [id, meta] of Object.entries(RULESET_FILES)) {
    const input = document.querySelector(`input[data-ruleset="${id}"]`);
    if (input) input.checked = (state.rulesetStates || {})[id] !== false;
    const countEl = document.getElementById(meta.countEl);
    if (countEl) {
      countEl.textContent = `${ruleCounts[id]} rules · ${meta.label}`;
    }
  }
}

function renderList(listEl, emptyEl, items, onRemove) {
  listEl.innerHTML = '';
  emptyEl.style.display = items.length ? 'none' : 'block';
  for (const item of items) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = item;
    const btn = document.createElement('button');
    btn.className = 'remove';
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => onRemove(item));
    li.append(span, btn);
    listEl.appendChild(li);
  }
}

function render() {
  renderStats();
  renderRulesets();
  renderList(
    document.getElementById('whitelistList'),
    document.getElementById('whitelistEmpty'),
    state.whitelist,
    async (domain) => {
      state.whitelist = state.whitelist.filter((d) => d !== domain);
      render();
      await send({ type: 'removeWhitelistDomain', domain });
    }
  );
  renderList(
    document.getElementById('customList'),
    document.getElementById('customEmpty'),
    state.customBlocked,
    async (domain) => {
      state.customBlocked = state.customBlocked.filter((d) => d !== domain);
      render();
      await send({ type: 'removeCustomDomain', domain });
    }
  );
}

/* ------------------------------ events ------------------------------ */

document.querySelectorAll('input[data-ruleset]').forEach((input) => {
  input.addEventListener('change', async () => {
    state.rulesetStates[input.dataset.ruleset] = input.checked;
    renderStats();
    await send({
      type: 'setRulesetEnabled',
      rulesetId: input.dataset.ruleset,
      enabled: input.checked,
    });
  });
});

document.getElementById('customForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('customInput');
  const error = document.getElementById('customError');
  const domain = input.value.trim().toLowerCase();
  error.textContent = '';
  if (!domain) return;

  const res = await send({ type: 'addCustomDomain', domain });
  if (res && res.ok === false) {
    error.textContent = 'Please enter a valid domain (e.g. ads.example.com).';
    return;
  }
  if (!state.customBlocked.includes(domain)) {
    state.customBlocked.push(domain);
  }
  input.value = '';
  render();
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!IS_EXTENSION || confirm('Reset the blocked-request counter to zero?')) {
    await send({ type: 'resetStats' });
    state.totalBlocked = 0;
    renderStats();
  }
});

/* ------------------------------ init ------------------------------ */

(async () => {
  await loadState();
  render();
})();
