# AdShield — Ad & Tracker Blocker

![Manifest V3](https://img.shields.io/badge/Manifest-V3-6366f1)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Brave-blue)
![No data collection](https://img.shields.io/badge/privacy-zero%20data%20collection-brightgreen)

A fast, privacy-first ad and tracker blocker for Chromium browsers, built on
**Manifest V3** and the **declarativeNetRequest** API. Blocking happens inside
the browser's networking engine — no request ever passes through extension
JavaScript, and **no data ever leaves the browser**.

<p>
  <img src="docs/screenshot-popup.png" width="320" alt="AdShield popup" />
  <img src="docs/screenshot-options.png" width="420" alt="AdShield settings page" />
</p>

## Features

- **Network-level blocking** of 159 curated ad, tracker and annoyance domains
  via three declarativeNetRequest rulesets (ads / trackers / annoyances) —
  toggle each list independently.
- **Cosmetic filtering** — a content script collapses the empty containers ads
  leave behind, with a `MutationObserver` that re-hides elements when sites
  try to resurrect them.
- **Per-site whitelist** — pause blocking on the current site from the popup;
  implemented as high-priority `allowAllRequests` dynamic rules.
- **Custom blocked domains** — add your own domains from the options page.
- **Live statistics** — per-page counter on the toolbar badge, plus lifetime
  totals, all stored locally in `chrome.storage`.
- **Privacy by design** — no analytics, no remote servers, no filter-list
  phone-home. The only network requests the extension makes are none.
- Clean dark UI for both the popup and the settings dashboard.

## Install (developer mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/<you>/adshield.git
   ```
2. Open `chrome://extensions` (works the same in Edge / Brave / Arc).
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the cloned folder.
5. Pin AdShield to the toolbar and click the shield to see it in action.

> Note: the live per-page blocked counter uses
> `declarativeNetRequest.onRuleMatchedDebug`, which Chrome only fires for
> developer-loaded extensions. Blocking itself works identically either way.

## How it works

```
┌────────────┐   web request    ┌──────────────────────────────┐
│   page     │ ───────────────► │  declarativeNetRequest engine │
└────────────┘                  │  (inside the browser)        │
                                └──────────────┬───────────────┘
                                               │ match?
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                   static rulesets      dynamic block rules   whitelist rules
                   (ads/trackers/       (user domains)        (allowAllRequests,
                    annoyances, 159)                           priority 100)
                                               │
                                               ▼
                                          block / allow
```

- **`manifest.json`** declares three static rulesets and the permissions.
- **`background.js`** (service worker) owns state: it applies the on/off
  switch, syncs whitelist/custom domains into *dynamic* DNR rules, counts
  blocked requests, and serves the popup/options pages over runtime messages.
- **`popup/`** is the toolbar UI: master toggle, page/total counters, and the
  per-site pause button.
- **`options/`** is the dashboard: stats cards, ruleset toggles, whitelist and
  custom-domain management.
- **`content/cosmetic.css|js`** hide ad leftovers that network blocking
  can't remove (they contain no ad requests, just empty boxes).

### Why declarativeNetRequest?

Manifest V3 removed blocking `webRequest`, so extensions can no longer inspect
every request in JavaScript. DNR moves matching into the browser's native
engine: rules are compiled once, evaluated in C++, and the extension never
sees your traffic. That is both the performance win and the privacy win.

## Project structure

```
adshield/
├── manifest.json            # MV3 manifest
├── background.js            # service worker: rules, stats, messaging API
├── popup/                   # toolbar popup (HTML/CSS/JS)
├── options/                 # settings dashboard (HTML/CSS/JS)
├── content/                 # cosmetic filtering (CSS + observer)
├── rulesets/                # generated DNR rulesets (159 rules)
├── icons/                   # generated icons (16/32/48/128)
├── tools/                   # generators for rulesets and icons
└── docs/                    # screenshots
```

## Customizing the filter lists

Domain lists live in `tools/generate_rules.py`, grouped by category. Add or
remove domains, then regenerate:

```bash
python3 tools/generate_rules.py   # rebuild rulesets/*.json
python3 tools/generate_icons.py   # (optional) rebuild icons
```

Reload the extension at `chrome://extensions` and your rules are live.

## Roadmap

- [ ] Import community filter lists (EasyList-compatible syntax → DNR)
- [ ] "Zapper" mode: click-to-remove any element on a page
- [ ] Per-category stats and a 7-day chart on the dashboard
- [ ] Firefox support (MV3 is now supported; minor manifest tweaks needed)
- [ ] Chrome Web Store release

## Contributing

Issues and PRs are welcome — especially new ruleset domains (please group
them by category in `tools/generate_rules.py`) and false-positive reports.

## License

[MIT](LICENSE) — do whatever you like, attribution appreciated.

---

*AdShield is an educational/portfolio project. It is not affiliated with any
browser vendor or existing ad-blocking product.*
