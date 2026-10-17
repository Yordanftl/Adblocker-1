#!/usr/bin/env python3
"""Generate declarativeNetRequest rulesets for AdShield.

Reads curated domain lists (below) and emits rulesets/*.json in the
declarativeNetRequest static-ruleset format. Run from the project root:

    python3 tools/generate_rules.py
"""
import json
import os

# Resource types the blocker matches. "main_frame" is intentionally excluded
# so clicking a sponsored link never leaves the user on a dead blank page.
RESOURCE_TYPES = [
    "sub_frame", "stylesheet", "script", "image", "font", "object",
    "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other",
]

AD_DOMAINS = [
    # --- Major programmatic / exchange networks ---
    "doubleclick.net", "googlesyndication.com", "googleadservices.com",
    "adservice.google.com", "adnxs.com", "adsymptotic.com",
    "rubiconproject.com", "pubmatic.com", "openx.net", "criteo.com",
    "criteo.net", "amazon-adsystem.com", "advertising.com", "adform.net",
    "smartadserver.com", "media.net", "bidswitch.net", "indexexchange.com",
    "indexww.com", "casalemedia.com", "contextweb.com", "pulsepoint.com",
    "lijit.com", "sovrn.com", "sharethrough.com", "triplelift.com",
    "teads.tv", "spotxchange.com", "springserve.com", "emxdgt.com",
    "onetag-sys.com", "adagio.io", "liadm.com", "adzerk.net",
    # --- Ad verification / serving infrastructure ---
    "moatads.com", "serving-sys.com", "flashtalking.com", "innovid.com",
    "adsafeprotected.com", "doubleverify.com",
    # --- Native / content-recommendation widgets ---
    "taboola.com", "outbrain.com", "outbrainimg.com", "zemanta.com",
    "nativo.com", "mgid.com", "revcontent.com", "zergnet.com",
    "adblade.com", "sharethis.com",
    # --- Retargeting / niche networks ---
    "adroll.com", "yieldmo.com", "gumgum.com", "33across.com",
    "consumable.com", "undertone.com", "kargo.com", "buysellads.com",
    # --- High-volume popup / low-quality networks ---
    "adcash.com", "popads.net", "popcash.net", "propellerads.com",
    "adsterra.com", "exoclick.com", "trafficjunky.com", "juicyads.com",
    "hilltopads.net", "plugrush.com", "ad-maven.com",
    # --- Publisher monetization platforms ---
    "ezoic.net", "mediavine.com", "adthrive.com", "monumetric.com",
    "freestar.io", "deployads.com", "snigelweb.com", "yieldlove.com",
    # --- Mobile / in-app ad networks leaking into webviews ---
    "adcolony.com", "applovin.com", "inmobi.com", "vungle.com",
    "chartboost.com", "startappservice.com", "tapjoy.com", "fyber.com",
    "smaato.net", "unityads.unity3d.com",
]

TRACKER_DOMAINS = [
    # --- Analytics ---
    "google-analytics.com", "googletagmanager.com", "mxpnl.com",
    "mixpanel.com", "segment.io", "segment.com", "amplitude.com",
    "heap.io", "heapanalytics.com", "kissmetrics.io", "statcounter.com",
    "histats.com", "chartbeat.com", "scorecardresearch.com",
    "quantserve.com", "pendo.io",
    # --- Session replay / heatmaps ---
    "hotjar.com", "mouseflow.com", "fullstory.com", "logrocket.com",
    "crazyegg.com", "luckyorange.com", "inspectlet.com",
    "contentsquare.net", "clarity.ms",
    # --- A/B testing / personalization ---
    "optimizely.com", "vwo.com",
    # --- Ad-tech identity / data brokers ---
    "demdex.net", "omtrdc.net", "everesttech.net", "bluekai.com",
    "krxd.net", "tapad.com", "crwdcntrl.net", "exelator.com",
    "imrworldwide.com", "rfihub.com", "mathtag.com", "addthis.com",
    # --- Social / search platform pixels ---
    "facebook.net", "analytics.twitter.com", "ads-twitter.com",
    "bat.bing.com", "ct.pinterest.com", "snap.licdn.com",
    "analytics.tiktok.com", "tr.snapchat.com",
    # --- Regional analytics ---
    "mc.yandex.ru", "mc.yandex.com",
    # --- APM beacons used for behavioral tracking ---
    "nr-data.net",
]

ANNOYANCE_DOMAINS = [
    # --- Web-push solicitation ---
    "onesignal.com", "pushcrew.com", "pushengage.com", "webpushr.com",
    "pushalert.co", "pushnami.com", "aimtell.com", "subscribers.com",
    "truepush.com", "letreach.com", "izooto.com", "pushwoosh.com",
    # --- Popup / lead-capture overlays ---
    "sumo.com", "sumome.com", "privy.com", "getsitecontrol.com",
    "sleeknote.com", "wisepops.com", "justuno.com", "omappapi.com",
    "bouncex.net", "hellobar.com",
]


def build_rules(domains):
    return [
        {
            "id": i + 1,
            "priority": 1,
            "action": {"type": "block"},
            "condition": {
                "urlFilter": f"||{domain}^",
                "resourceTypes": RESOURCE_TYPES,
            },
        }
        for i, domain in enumerate(sorted(set(domains)))
    ]


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "rulesets")
    os.makedirs(out_dir, exist_ok=True)
    for name, domains in [
        ("ads", AD_DOMAINS),
        ("trackers", TRACKER_DOMAINS),
        ("annoyances", ANNOYANCE_DOMAINS),
    ]:
        rules = build_rules(domains)
        path = os.path.join(out_dir, f"{name}.json")
        with open(path, "w") as f:
            json.dump(rules, f, indent=2)
        print(f"{name}.json: {len(rules)} rules")


if __name__ == "__main__":
    main()
