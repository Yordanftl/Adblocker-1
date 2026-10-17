'use strict';

/**
 * AdShield cosmetic filtering — script half.
 *
 * The companion cosmetic.css hides ad containers with `display: none`.
 * Some sites fight back by re-showing those nodes via inline styles or
 * class flips; this observer re-collapses any matching element that
 * becomes visible again. Work is throttled so busy pages stay fast.
 */

const SELECTORS = [
  '.adsbygoogle',
  'iframe[id^="google_ads_iframe"]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication.com"]',
  'div[id^="div-gpt-ad"]',
  '[data-ad-slot]',
  '[data-ad-manager]',
  '.taboola',
  '.outbrain',
  '.OUTBRAIN',
].join(',');

function collapse(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return;
  const style = el.style;
  if (style.display !== 'none') {
    style.setProperty('display', 'none', 'important');
    style.setProperty('visibility', 'hidden', 'important');
    style.setProperty('height', '0', 'important');
  }
}

function sweep(root) {
  try {
    root.querySelectorAll(SELECTORS).forEach(collapse);
  } catch {
    /* invalid context (e.g. detached root) — ignore */
  }
}

let scheduled = false;
function scheduleSweep() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    if (document.body) sweep(document.body);
  }, 400);
}

function start() {
  sweep(document.documentElement);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          scheduleSweep();
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (document.documentElement) {
  start();
} else {
  document.addEventListener('DOMContentLoaded', start, { once: true });
}
