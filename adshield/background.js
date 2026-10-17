'use strict';

/**
 * AdShield background service worker.
 *
 * Responsibilities:
 *  - Enable/disable static declarativeNetRequest rulesets
 *  - Maintain per-tab and lifetime blocked-request counters + badge
 *  - Manage the site whitelist (dynamic allowAllRequests rules)
 *  - Manage user-added custom blocked domains (dynamic block rules)
 *  - Serve state to the popup / options pages via runtime messages
 */

const RULESET_IDS = ['ruleset_ads', 'ruleset_trackers', 'ruleset_annoyances'];
const WHITELIST_RULE_BASE = 400000;
const CUSTOM_RULE_BASE = 500000;

const ALL_RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
  'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket',
  'other',
];

const DEFAULTS = {
  enabled: true,
  totalBlocked: 0,
  installDate: 0,
  whitelist: [],
  customBlocked: [],
  rulesetStates: {
    ruleset_ads: true,
    ruleset_trackers: true,
    ruleset_annoyances: true,
  },
};

/** In-memory per-tab blocked counters (reset on navigation). */
const tabCounts = new Map();

/* ------------------------------------------------------------------ */
/* Storage helpers                                                     */
/* ------------------------------------------------------------------ */

function getSettings() {
  return chrome.storage.local.get(DEFAULTS);
}

/* ------------------------------------------------------------------ */
/* Ruleset management                                                  */
/* ------------------------------------------------------------------ */

async function applyProtection() {
  const s = await getSettings();
  if (s.enabled) {
    const enable = RULESET_IDS.filter((id) => s.rulesetStates[id] !== false);
    const disable = RULESET_IDS.filter((id) => s.rulesetStates[id] === false);
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enable,
      disableRulesetIds: disable,
    });
  } else {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: RULESET_IDS,
    });
  }
  await refreshAllBadges();
}

/**
 * Rebuild the dynamic rules for a domain list (whitelist or custom block).
 * Whitelist rules use allowAllRequests at high priority so they override
 * every static rule; custom rules block requests to the given domains.
 */
async function rebuildDomainRules(domains, idBase, kind) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing
    .filter((r) => r.id >= idBase && r.id < idBase + 100000)
    .map((r) => r.id);

  const addRules = domains.map((domain, i) => ({
    id: idBase + i,
    priority: 100,
    action: { type: kind === 'allow' ? 'allowAllRequests' : 'block' },
    condition: {
      requestDomains: [domain],
      resourceTypes: ALL_RESOURCE_TYPES,
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

async function updateBadge(tabId) {
  const { enabled } = await chrome.storage.local.get({ enabled: true });
  if (!enabled) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#64748b' });
    await chrome.action.setBadgeText({ tabId, text: 'OFF' });
    return;
  }
  const count = tabCounts.get(tabId) || 0;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#4f46e5' });
  await chrome.action.setBadgeText({
    tabId,
    text: count > 0 ? (count > 999 ? '999+' : String(count)) : '',
  });
}

async function refreshAllBadges() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null) await updateBadge(tab.id);
  }
}

/* ------------------------------------------------------------------ */
/* Blocked-request counting                                            */
/*                                                                     */
/* onRuleMatchedDebug fires for developer-loaded (unpacked)            */
/* extensions with the declarativeNetRequestFeedback permission.       */
/* ------------------------------------------------------------------ */

let pendingBlocked = 0;
let flushTimer = null;

function bumpTotal(n) {
  pendingBlocked += n;
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    const batch = pendingBlocked;
    pendingBlocked = 0;
    flushTimer = null;
    const { totalBlocked } = await chrome.storage.local.get({ totalBlocked: 0 });
    await chrome.storage.local.set({ totalBlocked: totalBlocked + batch });
  }, 800);
}

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const tabId = info.request && info.request.tabId;
    if (tabId == null || tabId < 0) return;
    tabCounts.set(tabId, (tabCounts.get(tabId) || 0) + 1);
    bumpTotal(1);
    updateBadge(tabId);
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    tabCounts.delete(tabId);
    updateBadge(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => tabCounts.delete(tabId));

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(async (details) => {
  const { installDate } = await chrome.storage.local.get({ installDate: 0 });
  if (!installDate) {
    await chrome.storage.local.set({ installDate: Date.now() });
  }
  if (details.reason === 'install') {
    console.log('[AdShield] Installed. Protection is on.');
  }
  await applyProtection();
});

chrome.runtime.onStartup.addListener(applyProtection);
// Also re-apply whenever the service worker spins up (MV3 workers are
// ephemeral), so protection survives browser restarts and worker reloads.
applyProtection();

/* ------------------------------------------------------------------ */
/* Messaging API for popup / options                                   */
/* ------------------------------------------------------------------ */

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const s = await getSettings();

    switch (msg.type) {
      case 'getState':
        sendResponse({
          enabled: s.enabled,
          totalBlocked: s.totalBlocked,
          installDate: s.installDate,
          whitelist: s.whitelist,
          customBlocked: s.customBlocked,
          rulesetStates: s.rulesetStates,
          pageBlocked: msg.tabId >= 0 ? tabCounts.get(msg.tabId) || 0 : 0,
        });
        break;

      case 'setEnabled': {
        await chrome.storage.local.set({ enabled: !!msg.enabled });
        await applyProtection();
        sendResponse({ ok: true });
        break;
      }

      case 'toggleWhitelist': {
        const host = String(msg.hostname || '').toLowerCase();
        if (!HOSTNAME_RE.test(host)) {
          sendResponse({ ok: false, error: 'invalid hostname' });
          return;
        }
        const whitelist = s.whitelist.includes(host)
          ? s.whitelist.filter((h) => h !== host)
          : [...s.whitelist, host];
        await chrome.storage.local.set({ whitelist });
        await rebuildDomainRules(whitelist, WHITELIST_RULE_BASE, 'allow');
        sendResponse({ ok: true, whitelisted: whitelist.includes(host) });
        break;
      }

      case 'removeWhitelistDomain': {
        const whitelist = s.whitelist.filter((h) => h !== msg.domain);
        await chrome.storage.local.set({ whitelist });
        await rebuildDomainRules(whitelist, WHITELIST_RULE_BASE, 'allow');
        sendResponse({ ok: true });
        break;
      }

      case 'addCustomDomain': {
        const domain = String(msg.domain || '').toLowerCase().trim();
        if (!HOSTNAME_RE.test(domain)) {
          sendResponse({ ok: false, error: 'invalid domain' });
          return;
        }
        if (!s.customBlocked.includes(domain)) {
          const customBlocked = [...s.customBlocked, domain];
          await chrome.storage.local.set({ customBlocked });
          await rebuildDomainRules(customBlocked, CUSTOM_RULE_BASE, 'block');
        }
        sendResponse({ ok: true });
        break;
      }

      case 'removeCustomDomain': {
        const customBlocked = s.customBlocked.filter((d) => d !== msg.domain);
        await chrome.storage.local.set({ customBlocked });
        await rebuildDomainRules(customBlocked, CUSTOM_RULE_BASE, 'block');
        sendResponse({ ok: true });
        break;
      }

      case 'setRulesetEnabled': {
        if (!RULESET_IDS.includes(msg.rulesetId)) {
          sendResponse({ ok: false, error: 'unknown ruleset' });
          return;
        }
        const rulesetStates = { ...s.rulesetStates, [msg.rulesetId]: !!msg.enabled };
        await chrome.storage.local.set({ rulesetStates });
        await applyProtection();
        sendResponse({ ok: true });
        break;
      }

      case 'resetStats': {
        tabCounts.clear();
        await chrome.storage.local.set({ totalBlocked: 0 });
        await refreshAllBadges();
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ ok: false, error: 'unknown message type' });
    }
  })().catch((err) => {
    console.error('[AdShield]', err);
    sendResponse({ ok: false, error: String(err) });
  });
  return true; // async response
});
